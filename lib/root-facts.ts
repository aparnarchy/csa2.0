/**
 * "Find the Root" — Phase 2: the fact-gathering layer (deterministic, no AI).
 * SERVER-ONLY (calls getDB). Own-data only (assertOwner).
 *
 * A pure function that turns one person's real data into a structured set of
 * facts. No AI involved here — this is what keeps the eventual AI output
 * "genuinely insightful, not a random prediction engine": the model (Phase 3)
 * only ever phrases what's already true here, never invents anything.
 *
 * Owner decisions this respects (2026-08-28, see memory
 * find-the-root-phase0-decisions): 1-month window; past employers may be
 * named directly; journal text is real prose the person wrote themselves.
 */

import { getDB } from "./db";
import { assertOwner } from "./access-control";
import { getEmployeeScores } from "./scores";
import { careerFacts } from "./career";
import { pillarExtremes } from "./ai";
import { loadRecommendations, pickRecommendation } from "./recommendations";
import { visibleAffectedActions } from "./feedback";
import type { PillarId, SessionUser } from "./types";

const WINDOW = "1M" as const;
/** Below this many characters, a journal entry isn't usable evidence
 *  ("k", a single emoji) — see Phase 2 edge case in the plan. */
const MIN_JOURNAL_LEN = 15;

export interface RootFacts {
  enough: boolean;
  weakestPillar: PillarId | null;
  weakestPillarScore: number | null;
  weakestPillarDelta: number | null;
  weakestPillarTrend: "rising" | "falling" | "flat" | null;
  weakestQuestion: { id: string; text: string; score: number } | null;
  /** Consecutive most-recent check-ins on the weakest question scoring below
   *  7, most-recent first, 0 if the latest isn't currently low. */
  lowStreak: number;
  priorAction: {
    actionText: string;
    visibleSinceLabel: string;
    employeeRespondedYes: boolean | null;
    scoreBefore: number | null;
    scoreAfter: number | null;
    movedUp: boolean | null;
  } | null;
  careerComparison: {
    bestCompany: string;
    bestScore: number;
    worstCompany: string;
    worstScore: number;
    currentIsWorst: boolean;
  } | null;
  /** The person's own follow_up reflections tied to the weakest pillar's
   *  questions — never a manager's coaching note (those are stored under the
   *  MANAGER's own userId, not this employee's, so filtering strictly on
   *  userId = this employee already excludes them; asserted here, not just
   *  assumed, since a future refactor that joins by pillar/question instead
   *  of owner id would silently leak a manager's private note into this
   *  employee's own AI prompt). */
  journalReflections: string[];
  /** Real admin-authored recommendation text the AI is allowed to cite for
   *  the weakest pillar — it must pick from these, never free-write one. */
  candidateRecommendations: string[];
}

const EMPTY: RootFacts = {
  enough: false,
  weakestPillar: null,
  weakestPillarScore: null,
  weakestPillarDelta: null,
  weakestPillarTrend: null,
  weakestQuestion: null,
  lowStreak: 0,
  priorAction: null,
  careerComparison: null,
  journalReflections: [],
  candidateRecommendations: [],
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

export async function gatherRootFacts(session: SessionUser, userId: string): Promise<RootFacts> {
  assertOwner(session, userId);
  const db = getDB();

  const data = await getEmployeeScores(session, userId, WINDOW);
  if (!data.enoughData || data.overall === null) return EMPTY;

  const scoredPillars = data.pillars.filter((p) => p.score !== null);
  if (scoredPillars.length === 0) return EMPTY;

  const weakest = scoredPillars.reduce((a, b) => ((b.score as number) < (a.score as number) ? b : a));
  const weakestPillar = weakest.pillarId;
  const weakestPillarScore = weakest.score as number;
  const weakestPillarDelta = weakest.delta;
  const weakestPillarTrend: RootFacts["weakestPillarTrend"] =
    weakestPillarDelta === null ? null : weakestPillarDelta > 0 ? "rising" : weakestPillarDelta < 0 ? "falling" : "flat";

  const qs = data.questions.filter((q) => q.pillarId === weakestPillar);
  const weakestQuestion = qs.length ? qs.reduce((a, b) => (b.score < a.score ? b : a)) : null;

  // ── Low streak on the weakest question ──────────────────────────────────
  let lowStreak = 0;
  if (weakestQuestion) {
    const { results } = await db
      .prepare(
        `SELECT score FROM checkIns WHERE userId = ? AND questionId = ?
          ORDER BY timestamp DESC, weekId DESC LIMIT 10`,
      )
      .bind(userId, weakestQuestion.id)
      .all<{ score: number }>();
    for (const r of results) {
      if (r.score < 7) lowStreak++;
      else break;
    }
  }

  // ── Did a manager action already target this pillar? Did it move the score? ──
  let priorAction: RootFacts["priorAction"] = null;
  const affected = await visibleAffectedActions(db, userId);
  const targeting = affected
    .filter((a) => a.pillarId === weakestPillar)
    .sort((a, b) => (b.visibleToEmployeesAt ?? "").localeCompare(a.visibleToEmployeesAt ?? ""))[0];
  if (targeting?.actionText && targeting.visibleToEmployeesAt) {
    const [before, after, resp] = await Promise.all([
      db
        .prepare(
          "SELECT AVG(score) AS avg FROM checkIns WHERE userId = ? AND pillarId = ? AND timestamp < ?",
        )
        .bind(userId, weakestPillar, targeting.visibleToEmployeesAt)
        .first<{ avg: number | null }>(),
      db
        .prepare(
          "SELECT AVG(score) AS avg FROM checkIns WHERE userId = ? AND pillarId = ? AND timestamp >= ?",
        )
        .bind(userId, weakestPillar, targeting.visibleToEmployeesAt)
        .first<{ avg: number | null }>(),
      db
        .prepare("SELECT response FROM employeeResponses WHERE userId = ? AND actionId = ?")
        .bind(userId, targeting.id)
        .first<{ response: string }>(),
    ]);
    const scoreBefore = before?.avg ?? null;
    const scoreAfter = after?.avg ?? null;
    priorAction = {
      actionText: targeting.actionText,
      visibleSinceLabel: monthLabel(targeting.visibleToEmployeesAt),
      employeeRespondedYes: resp ? resp.response === "yes" : null,
      scoreBefore,
      scoreAfter,
      movedUp: scoreBefore !== null && scoreAfter !== null ? scoreAfter > scoreBefore : null,
    };
  }

  // ── Career comparison, scoped to the weakest pillar only ────────────────
  let careerComparison: RootFacts["careerComparison"] = null;
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
    const ex = pillarExtremes(companies, weakestPillar);
    if (ex) {
      careerComparison = {
        bestCompany: ex.best.name,
        bestScore: ex.best.score,
        worstCompany: ex.worst.name,
        worstScore: ex.worst.score,
        currentIsWorst: ex.worst.name === (emp.companyName ?? "Current company"),
      };
    }
  }

  // ── This person's own follow_up reflections on the weakest pillar ───────
  // userId = this employee, type = 'follow_up' — a manager's private coaching
  // note is stored under the MANAGER's own userId (see lib/feedback.ts
  // submitManagerAction), never this employee's, so this filter cannot leak one.
  const { results: journalRows } = await db
    .prepare(
      `SELECT je.text AS text
         FROM journalEntries je
         JOIN questions q ON q.id = je.questionId
        WHERE je.userId = ? AND je.type = 'follow_up' AND q.pillarId = ?
        ORDER BY je.submittedAt DESC LIMIT 5`,
    )
    .bind(userId, weakestPillar)
    .all<{ text: string }>();
  const journalReflections = journalRows
    .map((r) => r.text.trim())
    .filter((t) => t.length >= MIN_JOURNAL_LEN)
    .slice(0, 3);

  // ── Real recommendation candidates for this pillar (never free-written) ──
  const recMap = await loadRecommendations();
  const { results: pillarQuestions } = await db
    .prepare("SELECT id FROM questions WHERE pillarId = ?")
    .bind(weakestPillar)
    .all<{ id: string }>();
  const candidateRecommendations = [
    ...new Set(pillarQuestions.map((q) => pickRecommendation(recMap, q.id, weakestPillar))),
  ].slice(0, 4);

  return {
    enough: true,
    weakestPillar,
    weakestPillarScore,
    weakestPillarDelta,
    weakestPillarTrend,
    weakestQuestion: weakestQuestion
      ? { id: weakestQuestion.id, text: weakestQuestion.text, score: weakestQuestion.score }
      : null,
    lowStreak,
    priorAction,
    careerComparison,
    journalReflections,
    candidateRecommendations,
  };
}
