/**
 * Insight lines that lead with what changed RECENTLY, then close with an
 * overall summary (owner, 2026-10-21: "highlight recent changes, e.g. the past
 * month, rather than static all-time summaries, followed by an overall
 * summary at the bottom"). Pure functions over data the screen already has
 * (trend points, pillar and question scores), all written in code — nothing
 * is invented. Works for any scope: you, a team, a department, the org.
 *
 * "Recent" = the last 4 weeks of check-ins (about a month), compared with the
 * weeks before it in the dashboard's window. With fewer weeks it halves what
 * there is, down to "this week against the week before".
 */
import { PILLARS, PILLAR_ORDER, STRENGTH_CUTOFF } from "./pillars";
import { questionTitle } from "./question-titles";
import type { PillarScore, QuestionInsight, TrendPoint } from "./data";
import type { PillarId } from "./types";

export const RECENT_WEEKS = 4;
/** A recent move this big (points) is worth leading with. */
export const RECENT_MOVE = 0.8;

/** The recent line and the overall summary travel as one string, split by this
 *  (server actions already return a string; AIInsight splits it back). */
export const SUMMARY_SEPARATOR = "\n";

export type Scope = "you" | "team" | "dept" | "org";

const n1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const label = (p: PillarId) => PILLARS[p].label;

export interface RecentMove {
  before: number;
  recent: number;
  change: number;
  /** How many weeks count as "recent" (4, or fewer with little data). */
  weeks: number;
}

/** One pillar's average over the recent weeks against the weeks before. */
export function recentMove(trend: TrendPoint[], pillarId: PillarId): RecentMove | null {
  const pts = trend.filter((t) => t[pillarId] !== null && Number.isFinite(t[pillarId]));
  if (pts.length < 2) return null;
  const weeks = Math.min(RECENT_WEEKS, Math.floor(pts.length / 2));
  const recent = avg(pts.slice(-weeks).map((t) => t[pillarId]!));
  const before = avg(pts.slice(0, -weeks).map((t) => t[pillarId]!));
  return { before, recent, change: recent - before, weeks };
}

const period = (weeks: number) => (weeks === 1 ? "since the week before" : `over the last ${weeks} weeks of check-ins`);

function moveSentence(pillarId: PillarId, m: RecentMove): string {
  const verb = m.change > 0 ? "risen" : "fallen";
  return `${label(pillarId)} has ${verb} from ${n1(m.before)} to ${n1(m.recent)} ${period(m.weeks)}.`;
}

const MOVE_MEANING = {
  up: "A climb over several weeks usually reflects something that actually changed, not one good week.",
  down: "A slide over several weeks usually reflects something that changed, not one bad week.",
};

/**
 * Dashboard insight: the pillar that moved most recently (≥ RECENT_MOVE,
 * `moved` true), else "steady recently". Null when there's no trend to compare.
 */
export function recentDashboardLine(
  trend: TrendPoint[],
  pillars: PillarScore[],
  scope: Scope,
): { text: string; moved: boolean } | null {
  const moves = PILLAR_ORDER.filter((p) => pillars.some((x) => x.pillarId === p && x.score !== null))
    .map((p) => ({ p, m: recentMove(trend, p) }))
    .filter((x): x is { p: PillarId; m: RecentMove } => x.m !== null);
  if (moves.length === 0) return null;
  const big = moves.filter((x) => Math.abs(x.m.change) >= RECENT_MOVE).sort((a, b) => Math.abs(b.m.change) - Math.abs(a.m.change));
  if (big.length) {
    const { p, m } = big[0];
    const whose = { you: "", team: " for your team", dept: " for this department", org: " across the organisation" }[scope];
    return {
      moved: true,
      text: `${moveSentence(p, m).slice(0, -1)}, the biggest recent move${whose}. ${m.change > 0 ? MOVE_MEANING.up : MOVE_MEANING.down}`,
    };
  }
  const widest = Math.max(...moves.map((x) => Math.abs(x.m.change)));
  return {
    moved: false,
    text: `Every pillar has held within ${n1(widest)} of where it was ${period(moves[0].m.weeks)}. Nothing has shifted much recently.`,
  };
}

/** "Overall: 6.8 across this period. Growth is the strongest pillar at 8.0, Compensation the weakest at 4.5." */
export function overallSummary(overall: number | null, pillars: PillarScore[]): string | null {
  const scored = pillars.filter((p) => p.score !== null);
  if (overall === null || scored.length === 0) return null;
  const sorted = [...scored].sort((a, b) => b.score! - a.score!);
  const top = sorted[0];
  const low = sorted[sorted.length - 1];
  const base = `Overall: ${n1(overall)} across this period.`;
  if (sorted.length < 2 || top.score === low.score) return base;
  return `${base} ${label(top.pillarId)} is the strongest pillar at ${n1(top.score!)}, ${label(low.pillarId)} the weakest at ${n1(low.score!)}.`;
}

/** Join a lead line and a summary for AIInsight (either may be missing). */
export function withSummary(lead: string | null, summary: string | null): string | null {
  if (lead && summary) return `${lead}${SUMMARY_SEPARATOR}${summary}`;
  return lead ?? summary;
}

/**
 * The insight at the top of one pillar's screen: what changed recently in
 * this pillar, and which part of it is pulling up or down; then the overall
 * picture for the pillar. Questions are the scope's per-question averages
 * (already anonymised for teams — only questions over the floor arrive).
 */
export function pillarInsight(
  pillarId: PillarId,
  score: number | null,
  trend: TrendPoint[],
  questions: QuestionInsight[],
): string | null {
  if (score === null) return null;
  const qs = [...questions].sort((a, b) => a.score - b.score);
  const weakest = qs[0];
  const strongest = qs[qs.length - 1];
  const title = (q: QuestionInsight) => questionTitle(q.id, q.text);

  const m = recentMove(trend, pillarId);
  let lead: string;
  if (m && Math.abs(m.change) >= RECENT_MOVE) {
    lead = moveSentence(pillarId, m);
    if (m.change < 0 && weakest && weakest.score <= STRENGTH_CUTOFF) lead += ` The lowest part is ${title(weakest)} at ${n1(weakest.score)}.`;
    else if (m.change > 0 && strongest && strongest.score > STRENGTH_CUTOFF) lead += ` The strongest part is ${title(strongest)} at ${n1(strongest.score)}.`;
    else lead += ` ${m.change > 0 ? MOVE_MEANING.up : MOVE_MEANING.down}`;
  } else if (m) {
    lead = `${label(pillarId)} has held steady at about ${n1(m.recent)} ${period(m.weeks)}.`;
  } else {
    lead = `${label(pillarId)} is at ${n1(score)} so far. A few more weeks will show which way it is heading.`;
  }

  let summary = `Overall: ${n1(score)} across this period`;
  if (qs.length >= 2 && strongest.score - weakest.score >= 1) {
    summary += `, from ${title(weakest)} at ${n1(weakest.score)} up to ${title(strongest)} at ${n1(strongest.score)}.`;
  } else if (qs.length >= 2) {
    summary += `, with every part of it close together.`;
  } else {
    summary += ".";
  }
  return withSummary(lead, summary);
}
