/**
 * Rich personal facts for the employee dashboard's single AI insight card —
 * everything in the app connected to one person (their pillar history, a
 * manager action's real before/after impact, how their current company
 * compares across their whole career, and their own journal reflections) so
 * the insight can surface a genuine pattern instead of just restating the
 * numbers already on screen. SERVER-ONLY (calls getDB). Own-data only
 * (assertOwner) — never an aggregate, so no anonymisation floor applies.
 *
 * Kept as its own module, not inlined into lib/ai.ts, specifically to avoid
 * a circular import: lib/career.ts already imports getCareerInsight from
 * lib/ai.ts, so lib/ai.ts importing careerFacts back from lib/career.ts
 * would cycle. This mirrors the same shape the old lib/root-facts.ts used
 * for the same reason.
 */

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "./db";
import { assertOwner } from "./access-control";
import { getEmployeeScores } from "./scores";
import { careerFacts } from "./career";
import { callGroq, pillarExtremes, signed, writeCache } from "./ai";
import { visibleAffectedActions } from "./feedback";
import { PILLARS } from "./pillars";
import type { EmployeeScores, Window } from "./data";
import type { PillarId, SessionUser } from "./types";

/** Below this many characters, a journal entry isn't usable evidence
 *  ("k", a single emoji). */
const MIN_JOURNAL_LEN = 15;

export interface EmployeeInsightFacts {
  enough: boolean;
  pillars: { pillarId: PillarId; score: number; delta: number | null }[];
  /** The person's own follow-up reflections, most recent first, any pillar —
      never a manager's coaching note (those are stored under the MANAGER's
      own userId, so filtering strictly on userId = this employee already
      excludes them). */
  journalReflections: string[];
  priorAction: {
    pillarLabel: string;
    actionText: string;
    visibleSinceLabel: string;
    movedUp: boolean | null;
  } | null;
  careerNote: {
    pillarLabel: string;
    bestCompany: string;
    bestScore: number;
    worstCompany: string;
    worstScore: number;
    currentIsWorst: boolean;
  } | null;
}

const EMPTY: EmployeeInsightFacts = {
  enough: false,
  pillars: [],
  journalReflections: [],
  priorAction: null,
  careerNote: null,
};

function monthLabel(iso: string | null): string {
  if (!iso) return "recently";
  const d = new Date(iso.replace(" ", "T"));
  if (isNaN(d.getTime())) return "recently";
  const days = Math.round((Date.now() - d.getTime()) / 864e5);
  if (days < 7) return "this week";
  if (days < 14) return "last week";
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export async function gatherEmployeeInsightFacts(
  session: SessionUser,
  userId: string,
): Promise<EmployeeInsightFacts> {
  assertOwner(session, userId);
  const db = getDB();

  const data = await getEmployeeScores(session, userId, "3M");
  if (!data.enoughData || data.overall === null) return EMPTY;
  const pillars = data.pillars
    .filter((p): p is typeof p & { score: number } => p.score !== null)
    .map((p) => ({ pillarId: p.pillarId, score: p.score, delta: p.delta }));
  if (pillars.length === 0) return EMPTY;

  // Recent reflections, any pillar — not narrowed to one weak spot.
  const { results: journalRows } = await db
    .prepare(
      `SELECT text FROM journalEntries WHERE userId = ? AND type = 'follow_up'
        ORDER BY submittedAt DESC LIMIT 5`,
    )
    .bind(userId)
    .all<{ text: string }>();
  const journalReflections = journalRows
    .map((r) => r.text.trim())
    .filter((t) => t.length >= MIN_JOURNAL_LEN)
    .slice(0, 3);

  // The most recent manager action visible to them (any pillar) and whether
  // their score in that pillar actually moved since.
  let priorAction: EmployeeInsightFacts["priorAction"] = null;
  const affected = await visibleAffectedActions(db, userId);
  const latest = [...affected].sort((a, b) =>
    (b.visibleToEmployeesAt ?? "").localeCompare(a.visibleToEmployeesAt ?? ""),
  )[0];
  if (latest?.actionText && latest.visibleToEmployeesAt) {
    const [before, after] = await Promise.all([
      db
        .prepare("SELECT AVG(score) AS avg FROM checkIns WHERE userId = ? AND pillarId = ? AND timestamp < ?")
        .bind(userId, latest.pillarId, latest.visibleToEmployeesAt)
        .first<{ avg: number | null }>(),
      db
        .prepare("SELECT AVG(score) AS avg FROM checkIns WHERE userId = ? AND pillarId = ? AND timestamp >= ?")
        .bind(userId, latest.pillarId, latest.visibleToEmployeesAt)
        .first<{ avg: number | null }>(),
    ]);
    const scoreBefore = before?.avg ?? null;
    const scoreAfter = after?.avg ?? null;
    priorAction = {
      pillarLabel: PILLARS[latest.pillarId].label,
      actionText: latest.actionText,
      visibleSinceLabel: monthLabel(latest.visibleToEmployeesAt),
      movedUp: scoreBefore !== null && scoreAfter !== null ? scoreAfter > scoreBefore : null,
    };
  }

  // Career comparison for whichever pillar has the widest spread across
  // their career — the one most likely to be worth a sentence.
  let careerNote: EmployeeInsightFacts["careerNote"] = null;
  const emp = await db
    .prepare(
      "SELECT companyName FROM employment WHERE userId = ? AND status = 'active' ORDER BY startedAt DESC LIMIT 1",
    )
    .bind(userId)
    .first<{ companyName: string | null }>();
  if (emp) {
    const allWindowScores = await getEmployeeScores(session, userId, "All");
    const companies = await careerFacts(userId, {
      name: emp.companyName ?? "Current company",
      scores: allWindowScores,
    });
    const spreads = pillars
      .map((p) => ({ p, ex: pillarExtremes(companies, p.pillarId) }))
      .filter((x): x is { p: (typeof pillars)[0]; ex: NonNullable<ReturnType<typeof pillarExtremes>> } => x.ex !== null)
      .sort((a, b) => b.ex.spread - a.ex.spread);
    if (spreads.length > 0) {
      const widest = spreads[0];
      careerNote = {
        pillarLabel: PILLARS[widest.p.pillarId].label,
        bestCompany: widest.ex.best.name,
        bestScore: widest.ex.best.score,
        worstCompany: widest.ex.worst.name,
        worstScore: widest.ex.worst.score,
        currentIsWorst: widest.ex.worst.name === (emp.companyName ?? "Current company"),
      };
    }
  }

  return { enough: true, pillars, journalReflections, priorAction, careerNote };
}

/**
 * The employee dashboard's single AI insight card — the ONLY AI insight box
 * on that screen (there used to be a second, separate "Find the Root" entry
 * point with its own click-through journey; removed in favour of folding its
 * richer fact-gathering in here instead, shown immediately, no click-through).
 * Same cache-by-fingerprint pattern as every other AI surface in lib/ai.ts.
 */
export async function getEmployeeInsight(
  session: SessionUser,
  userId: string,
  window: Window,
  scores: EmployeeScores,
): Promise<string | null> {
  // Needs at least 3 answered check-ins of their own before an AI read is
  // meaningful — 1-2 data points isn't a pattern, it's noise. Below that,
  // returning null here falls through to AIInsight's own fallback copy
  // ("...once enough check-ins are in"), so the card still explains why
  // there's nothing yet rather than looking broken or empty.
  if (!scores.enoughData || scores.overall === null || scores.responseCount < 3) return null;

  const facts = await gatherEmployeeInsightFacts(session, userId);
  if (!facts.enough) return null;

  const fingerprint = JSON.stringify({
    s: scores.overall,
    d: scores.delta,
    pi: facts.pillars.map((p) => [p.pillarId, p.score, p.delta]),
    j: facts.journalReflections,
    pa: facts.priorAction,
    cn: facts.careerNote,
  });
  const id = `employee:${userId}|${window}`;

  try {
    const db = getDB();
    const cached = await db
      .prepare("SELECT fingerprint, text FROM aiInsights WHERE id = ?")
      .bind(id)
      .first<{ fingerprint: string; text: string }>();
    if (cached && cached.fingerprint === fingerprint) return cached.text;

    const apiKey = getRequestContext().env.GROQ_API_KEY;
    if (!apiKey) return null;

    const system =
      "You write the single AI insight card on someone's own workplace-happiness dashboard, " +
      "addressed to them as \"you\". It's the only insight box on the screen — it should read " +
      "as a genuine, specific pattern you noticed about them, not a generic restatement of " +
      "their scores. Prefer connecting two facts (a score trend lining up with a past manager " +
      "action, or how their current company compares to the rest of their career) over just " +
      "listing pillar numbers, when a real connection exists in the facts given. " +
      "Use ONLY the facts provided - never invent a number, company or detail. " +
      "Write 3-4 short sentences, at most 75 words, in warm plain British English, and end on " +
      "one concrete, low-effort suggestion. No headings, bullet points, emojis or quotation marks.";

    const factLines = [
      `Pillar scores: ${facts.pillars
        .map((p) => `${PILLARS[p.pillarId].label} ${p.score}/10${p.delta !== null ? ` (${signed(p.delta)})` : ""}`)
        .join(", ")}.`,
      facts.priorAction
        ? `Their manager took an action on ${facts.priorAction.pillarLabel}, visible to them since ${facts.priorAction.visibleSinceLabel}: "${facts.priorAction.actionText}". ` +
          (facts.priorAction.movedUp === null
            ? "Not enough data yet to tell if it's helped."
            : facts.priorAction.movedUp
              ? "Their score in that area has gone up since."
              : "Their score in that area hasn't improved since.")
        : null,
      facts.careerNote
        ? `Across their whole career, in ${facts.careerNote.pillarLabel}: best at ${facts.careerNote.bestCompany} (${facts.careerNote.bestScore}/10), weakest at ${facts.careerNote.worstCompany} (${facts.careerNote.worstScore}/10).` +
          (facts.careerNote.currentIsWorst ? " Their CURRENT company is the weakest point in their career for this." : "")
        : null,
      facts.journalReflections.length > 0
        ? "Their own words, from reflections they wrote after recent low scores (use to understand how they feel, do not quote verbatim): " +
          facts.journalReflections.map((t) => `"${t}"`).join(" / ")
        : null,
    ].filter((l): l is string => l !== null);

    const text = await callGroq(apiKey, system, factLines.join("\n"));
    if (!text) return null;

    await writeCache(id, fingerprint, text);
    return text;
  } catch {
    return null;
  }
}
