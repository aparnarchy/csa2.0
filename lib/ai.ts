/**
 * AI qualitative snapshot for the dashboards (Phase 5.1). SERVER-ONLY (calls
 * getDB and reads the GROQ_API_KEY secret).
 *
 * PRIVACY — only aggregate numbers ever enter the prompt: overall score,
 * delta, participation % and pillar averages. Never a name, an individual
 * score, or any free text a person wrote.
 *
 * NEVER BLOCKS A DASHBOARD — any failure (missing key, timeout, bad response)
 * returns null and the AIInsight box renders its fallback line instead.
 *
 * COST CONTROL — the generated text is cached in D1 (aiInsights) keyed by
 * scope + time window, fingerprinted by the numbers, so the LLM is only
 * called when the underlying scores change.
 */

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "./db";
import { PILLARS, PILLAR_ORDER } from "./pillars";
import type { CeoDashboard, ManagerDetail, PillarScore, TeamAggregate, TrendPoint, Window } from "./data";
import { overallSummary, recentDashboardLine, withSummary } from "./recent-insight";
import type { PillarId } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// llama-3.3-70b-versatile was removed from Groq entirely (not renamed — gone
// from the account's model list, confirmed 2026-08-28 via /v1/models). This
// was silently falling back to the static copy for every AI insight box; any
// already-cached text kept displaying, which is what made it look "working."
const MODEL = "openai/gpt-oss-120b";
const TIMEOUT_MS = 8000;

interface InsightFacts {
  kind: "team" | "dept" | "org";
  label: string; // never a person's name — "this team", a dept name, or the org
  score: number;
  delta: number | null;
  participation: number | null;
  pillars: PillarScore[];
  /** Weekly points for the window — used to lead with the recent change. */
  trend: TrendPoint[];
}

/**
 * Let the AI write the insight wording? OFF (owner, 2026-10-14): it invented
 * causes that aren't in the data ("the new development programme you
 * joined", "a recent reshuffle") and slipped in advice. While off, every
 * insight card shows a plain sentence built straight from the numbers — never
 * anything that isn't in the data. Flip back on only with stricter grounding.
 */
export const AI_WORDING = false;

/**
 * The team / department / organisation insight, written in code from the
 * numbers (no AI): the single most telling RECENT pattern, plus what it
 * usually means, then an overall summary line (owner, 2026-10-21: recent
 * changes first, the overall picture at the bottom). Lead, in priority order —
 *   1. the pillar that moved most over the last 4 weeks of check-ins (≥ 0.8),
 *   2. the pillar that moved most from last week to this week (≥ 0.8) —
 *      PillarScore.delta is week-on-week, not a change in the average,
 *   3. that every pillar has held steady recently,
 *   4. with no trend to compare: the strongest/weakest gap, or the spread.
 */
function plainDashboardLine(facts: InsightFacts, scored: PillarScore[]): string {
  const scope = ({ team: "team", dept: "dept", org: "org" } as const)[facts.kind];
  const recent = recentDashboardLine(facts.trend, facts.pillars, scope);
  const summary = overallSummary(facts.score, facts.pillars);
  if (recent?.moved) return withSummary(recent.text, summary)!;
  const weekly = weeklyOrSpreadLine(facts, scored);
  if (weekly.moved) return withSummary(weekly.text, summary)!;
  return withSummary(recent?.text ?? weekly.text, recent ? summary : null)!;
}

function weeklyOrSpreadLine(facts: InsightFacts, scored: PillarScore[]): { text: string; moved: boolean } {
  const who = { team: "your team", dept: facts.label, org: "the organisation" }[facts.kind];
  const whose = { team: "your team's", dept: `${facts.label}'s`, org: "the organisation's" }[facts.kind];
  const name = (p: PillarScore) => PILLARS[p.pillarId].label;
  const n = (x: number) => x.toFixed(1);

  const movers = scored
    .filter((p) => p.delta !== null && Math.abs(p.delta) >= 0.8)
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!));
  if (movers.length) {
    const m = movers[0];
    const pts = n(Math.abs(m.delta!));
    const text = m.delta! < 0
      ? `${name(m)} dropped ${pts} points from last week to this week, the biggest weekly move for ${who}. A sharp drop in a single week usually means something specific happened, not a gradual drift.`
      : `${name(m)} rose ${pts} points from last week to this week, the biggest weekly move for ${who}. A jump this clear usually reflects something that actually changed, not just a good day.`;
    return { text, moved: true };
  }

  const sorted = [...scored].sort((a, b) => b.score! - a.score!);
  const top = sorted[0];
  const low = sorted[sorted.length - 1];
  const gap = top.score! - low.score!;
  if (sorted.length > 1 && gap >= 1.5) {
    return { moved: false, text: `${name(top)} leads at ${n(top.score!)} while ${name(low)} trails at ${n(low.score!)}. A strong pillar is usually what keeps people engaged; a weak one is usually what makes them restless, so ${name(low)} is the one to watch.` };
  }
  if (sorted.length > 1) {
    return { moved: false, text: `All of ${whose} pillars sit within ${n(gap)} of each other, from ${n(low.score!)} to ${n(top.score!)}. No single area is pulling things down, so changes over the next few weeks will be easy to spot.` };
  }
  return { moved: false, text: `${name(top)} is at ${n(top.score!)} so far. More answers will show which way it is heading.` };
}

export function signed(n: number): string {
  return `${n >= 0 ? "+" : ""}${n}`;
}

/**
 * Core generate-or-reuse. `cacheKey` identifies one dashboard scope (e.g.
 * "team-mgr:<managerId>"); each view keeps its own cache row per window
 * because each sends slightly different facts to the model.
 */
export async function getDashboardInsight(
  cacheKey: string,
  window: Window,
  facts: InsightFacts,
): Promise<string | null> {
  const scored = facts.pillars.filter((p) => p.score !== null);
  if (scored.length === 0) return null;
  if (!AI_WORDING) return plainDashboardLine(facts, scored);

  const fingerprint = JSON.stringify({
    // Bump when the prompt changes so saved insights are rewritten (v2:
    // shorter, 1-2 sentences / 35 words — owner, 2026-10-14).
    v: 2,
    s: facts.score,
    d: facts.delta,
    p: facts.participation,
    pi: scored.map((p) => [p.pillarId, p.score, p.delta]),
  });
  const id = `${cacheKey}|${window}`;

  try {
    const db = getDB();
    const cached = await db
      .prepare("SELECT fingerprint, text FROM aiInsights WHERE id = ?")
      .bind(id)
      .first<{ fingerprint: string; text: string }>();
    if (cached && cached.fingerprint === fingerprint) return cached.text;

    const apiKey = getRequestContext().env.GROQ_API_KEY;
    if (!apiKey) return null;

    const scopeNoun = { team: "team", dept: "department", org: "organisation" }[facts.kind];
    const system =
      `You write the short "AI insight" box on a workplace-happiness dashboard for a ${scopeNoun} leader. ` +
      "Write 1-2 short sentences, at most 35 words, in warm plain British English. " +
      "Name the strongest and weakest pillars and give one practical, low-effort suggestion aimed at the weakest. " +
      "Use only the numbers provided - never invent data, and never refer to individuals (the data is an anonymous aggregate). " +
      "No headings, bullet points, emojis or quotation marks.";

    const factLines = [
      `Scope: ${facts.kind === "team" ? "a team" : facts.label} over the last ${window === "All" ? "available period" : window}.`,
      `Overall happiness score: ${facts.score}/10${facts.delta !== null ? ` (${signed(facts.delta)} vs the previous week)` : ""}.`,
      facts.participation !== null ? `Check-in participation: ${facts.participation}%.` : null,
      `Pillar averages: ${scored
        .map(
          (p) =>
            `${PILLARS[p.pillarId].label} ${p.score}/10${p.delta !== null ? ` (${signed(p.delta)})` : ""}`,
        )
        .join(", ")}.`,
    ].filter(Boolean);

    const text = await callGroq(apiKey, system, factLines.join("\n"));
    if (!text) return null;

    await writeCache(id, fingerprint, text);
    return text;
  } catch {
    return null; // dashboards render their fallback line; never blocked on AI
  }
}

/** One chat completion, or null on any failure. `opts` gives a call more
 *  thinking room than the default short dashboard summary needs. */
export async function callGroq(
  apiKey: string,
  system: string,
  user: string,
  opts: { reasoningEffort?: "low" | "medium" | "high"; maxTokens?: number; timeoutMs?: number } = {},
): Promise<string | null> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      // gpt-oss is a reasoning model — it spends some of max_tokens on a
      // hidden "reasoning" pass before the visible answer, so the budget
      // needs headroom beyond just the ~55-word answer itself.
      max_tokens: opts.maxTokens ?? 350,
      reasoning_effort: opts.reasoningEffort ?? "low",
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim().replace(/^"|"$/g, "") ?? null;
}

export async function writeCache(id: string, fingerprint: string, text: string): Promise<void> {
  await getDB()
    .prepare(
      `INSERT INTO aiInsights (id, fingerprint, text, createdAt) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET fingerprint = excluded.fingerprint,
         text = excluded.text, createdAt = excluded.createdAt`,
    )
    .bind(id, fingerprint, text, new Date().toISOString())
    .run();
}

/** Team insight for a manager's own dashboard. Skips the AI below the floor. */
export function getTeamInsight(
  managerId: string,
  window: Window,
  agg: TeamAggregate,
): Promise<string | null> {
  if (!agg.enoughData || agg.teamScore === null) return Promise.resolve(null);
  return getDashboardInsight(`team-mgr:${managerId}`, window, {
    kind: "team",
    label: "this team",
    score: agg.teamScore,
    delta: agg.delta,
    participation: agg.participation,
    pillars: agg.pillars,
    trend: agg.trend,
  });
}

/** Team insight for the reviewing-manager detail screen. */
export function getManagerDetailInsight(
  managerId: string,
  window: Window,
  detail: ManagerDetail,
): Promise<string | null> {
  if (!detail.enoughData || detail.teamScore === null) return Promise.resolve(null);
  return getDashboardInsight(`rm-team:${managerId}`, window, {
    kind: "team",
    label: "this team",
    score: detail.teamScore,
    delta: detail.delta,
    participation: null,
    pillars: detail.pillars,
    trend: detail.trend,
  });
}

// getEmployeeInsight moved to lib/employee-facts.ts — it needs
// gatherEmployeeInsightFacts from that same module, and that module needs
// pillarExtremes from here, so the function that calls both has to live on
// one side of that pair, not in ai.ts itself (importing it back here would
// cycle: ai.ts -> employee-facts.ts -> ai.ts).

// ─────────────────────────────────────────────────────────────────────────────
// Career insight — the ✨ box on a company page. Unlike the dashboard insights
// above, this is the user's OWN data (never an aggregate), and it spans every
// company in their history plus their current job, because the whole point is
// the comparison between them.
// ─────────────────────────────────────────────────────────────────────────────

export interface CareerCompanyFacts {
  id: string;
  name: string;
  current: boolean;
  overall: number;
  /** Pillars this company has a score for; a company may not cover all four. */
  pillars: { pillarId: PillarId; score: number }[];
}

/** Highest and lowest company for one pillar, ignoring companies missing it.
 *  Exported for lib/root-facts.ts's career-comparison fact — same rule, reused
 *  verbatim rather than reimplemented. */
export function pillarExtremes(companies: CareerCompanyFacts[], pillarId: PillarId) {
  const withPillar = companies
    .map((c) => ({ name: c.name, score: c.pillars.find((p) => p.pillarId === pillarId)?.score }))
    .filter((c): c is { name: string; score: number } => c.score !== undefined);
  if (withPillar.length < 2) return null;

  const sorted = [...withPillar].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  if (best.score === worst.score) return null; // flat — nothing to say
  return { best, worst, spread: Math.round((best.score - worst.score) * 10) / 10 };
}

/**
 * The ✨ insight for one company page.
 *
 * The comparisons are computed here — per-pillar bests and worsts, the spread,
 * and where this company ranks — and only those resolved facts go to the model,
 * which picks the interesting one and phrases it. That's deliberate: handing
 * over raw rows and asking it to compare invites invented companies and wrong
 * arithmetic. It can only talk about what's in the list it was given.
 *
 * Returns null with fewer than two companies (nothing to compare), with no API
 * key, or on any failure — the box shows its fallback line and the page is
 * never blocked.
 */
export async function getCareerInsight(
  userId: string,
  focusId: string,
  companies: CareerCompanyFacts[],
): Promise<string | null> {
  if (companies.length < 2) return null;
  const focus = companies.find((c) => c.id === focusId);
  if (!focus) return null;

  const fingerprint = JSON.stringify({
    f: focusId,
    c: companies.map((c) => [c.id, c.overall, c.pillars.map((p) => [p.pillarId, p.score])]),
  });
  const id = `career:${userId}|${focusId}`;
  if (!AI_WORDING) return plainCareerLine(focus, companies);

  try {
    const db = getDB();
    const cached = await db
      .prepare("SELECT fingerprint, text FROM aiInsights WHERE id = ?")
      .bind(id)
      .first<{ fingerprint: string; text: string }>();
    if (cached && cached.fingerprint === fingerprint) return cached.text;

    const apiKey = getRequestContext().env.GROQ_API_KEY;
    if (!apiKey) return null;

    // Resolved comparisons, widest-spread pillar first — that's the one most
    // likely to be worth a sentence.
    const comparisons = PILLAR_ORDER.map((pid) => ({ pid, ex: pillarExtremes(companies, pid) }))
      .filter((c): c is { pid: PillarId; ex: NonNullable<ReturnType<typeof pillarExtremes>> } => c.ex !== null)
      .sort((a, b) => b.ex.spread - a.ex.spread)
      .map(
        ({ pid, ex }) =>
          `${PILLARS[pid].label}: best at ${ex.best.name} (${ex.best.score}/10), weakest at ${ex.worst.name} (${ex.worst.score}/10).`,
      );

    const byOverall = [...companies].sort((a, b) => b.overall - a.overall);
    const rank = byOverall.findIndex((c) => c.id === focusId) + 1;
    const average =
      Math.round((companies.reduce((s, c) => s + c.overall, 0) / companies.length) * 10) / 10;

    const system =
      "You write the short \"AI insight\" box on someone's own career-history page, " +
      "comparing one company against the rest of their career. " +
      "Write 1-2 sentences, at most 40 words, in warm plain British English, addressed to them as \"you\". " +
      "Use ONLY the companies and numbers given - never invent an employer, a role, a date or a figure, " +
      "and never mention a company that is not in the list. " +
      "Pick the single most interesting comparison rather than listing everything. " +
      "No headings, bullet points, emojis or quotation marks.";

    const factLines = [
      `The page is about: ${focus.name}${focus.current ? " (their current job)" : ""}.`,
      `Companies in their history: ${companies.map((c) => `${c.name} ${c.overall}/10`).join(", ")}.`,
      `${focus.name} ranks ${rank} of ${companies.length} by overall score; their career average is ${average}/10.`,
      `${focus.name} pillar scores: ${focus.pillars
        .map((p) => `${PILLARS[p.pillarId].label} ${p.score}/10`)
        .join(", ")}.`,
      comparisons.length ? `Across their career - ${comparisons.join(" ")}` : null,
    ].filter(Boolean) as string[];

    const text = await callGroq(apiKey, system, factLines.join("\n"));
    if (!text) return null;

    await writeCache(id, fingerprint, text);
    return text;
  } catch {
    return null;
  }
}

/** Org / department / team insight for the CEO-HR dashboard. */
export function getCeoInsight(window: Window, d: CeoDashboard): Promise<string | null> {
  if (!d.enoughData || d.score === null) return Promise.resolve(null);
  return getDashboardInsight(`ceo:${d.scope}`, window, {
    kind: d.scopeKind,
    label: d.scopeKind === "org" ? "the whole organisation" : d.scopeLabel,
    score: d.score,
    delta: d.delta,
    participation: null,
    pillars: d.pillars,
    trend: d.trend,
  });
}

/**
 * The career insight written in code (AI wording off — owner, 2026-10-21: the
 * AI's career line read as random). Where this job ranks overall against
 * their career average, plus the pillar this job is best or worst at across
 * every job they've told us about. Only their own entered scores are used.
 */
function plainCareerLine(focus: CareerCompanyFacts, companies: CareerCompanyFacts[]): string {
  const n = (x: number) => x.toFixed(1);
  const byOverall = [...companies].sort((a, b) => b.overall - a.overall);
  const rank = byOverall.findIndex((c) => c.id === focus.id) + 1;
  const average = companies.reduce((s, c) => s + c.overall, 0) / companies.length;
  const where = focus.current ? "this job" : focus.name;
  const ordinal = rank === 1 ? "the highest" : rank === companies.length ? "the lowest" : `number ${rank}`;
  const lead = `${focus.name} scores ${n(focus.overall)} overall, ${ordinal} of the ${companies.length} jobs you've told us about (your average is ${n(average)}).`;

  // The widest-spread pillar where this job is the best or the worst.
  const standout = PILLAR_ORDER.map((pid) => ({ pid, ex: pillarExtremes(companies, pid) }))
    .filter((c): c is { pid: PillarId; ex: NonNullable<ReturnType<typeof pillarExtremes>> } => c.ex !== null)
    .filter((c) => c.ex.best.name === focus.name || c.ex.worst.name === focus.name)
    .sort((a, b) => b.ex.spread - a.ex.spread)[0];
  if (!standout) return lead;
  const best = standout.ex.best.name === focus.name;
  const score = best ? standout.ex.best.score : standout.ex.worst.score;
  return `${lead} ${PILLARS[standout.pid].label} is ${best ? "higher" : "lower"} at ${where} (${n(score)}) than at any other job you've had.`;
}
