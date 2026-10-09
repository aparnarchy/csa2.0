/**
 * Picks what the employee's AI insight card says. Pure, no database, no AI.
 *
 * The owner's rules (2026-10-09): the card says "here's what I noticed", never
 * what to do; it's grounded in the person's real answers (the question and
 * option wording); and with little data it states the obvious and says more
 * check-ins are needed, instead of guessing or defaulting to negative.
 *
 * So code decides WHAT to say: it turns the answers into candidate facts, each
 * a plain sentence from copy.html, ranks them, and keeps the top one or two.
 * The AI (lib/employee-facts.ts) only rewords those sentences into one smooth
 * line; when it's unavailable the sentences show as they are.
 */
import { COPY, fill } from "./copy";
import { PILLARS, PILLAR_ORDER, STRENGTH_CUTOFF } from "./pillars";
import type { TrendPoint } from "./data";
import type { PillarId } from "./types";

/** Below this many answers in the window, or with one week of data, it's "early days". */
export const EARLY_ANSWERS = 6;
/** A week-over-week move in the overall score at least this big leads the card. */
export const BIG_CHANGE = 1.5;
/** Same answer at least this many times running counts as a streak. */
const STREAK_MIN = 3;
/** A pillar trend needs at least this many weeks in a row. */
const PILLAR_RUN_MIN = 4;
/** A changed answer older than this isn't news any more. */
const SHIFT_MAX_WEEKS_AGO = 3;

export interface AnswerHistory {
  questionId: string;
  text: string;
  pillarId: PillarId;
  options: { text: string; score: number }[];
  /** This person's answers to it, oldest first. */
  answers: number[];
  /** How many weeks ago the latest answer was (0 = the most recent week with data). */
  weeksAgo: number;
}

export interface SignalInput {
  firstName: string;
  overall: number;
  delta: number | null;
  trend: TrendPoint[];
  history: AnswerHistory[];
  hasCareerHistory: boolean;
  priorAction: { pillarId: PillarId; sinceLabel: string; movedUp: boolean } | null;
  /** Pillars where this job is strictly the best / worst across their career. */
  careerExtremes: { pillarId: PillarId; kind: "best" | "worst" }[];
}

export interface InsightPlan {
  eyebrow: string;
  /** One or two plain sentences: what the AI rewords, and the fallback. */
  facts: string[];
  foot: string;
  /** Set when the foot line is the career-history nudge. */
  footHref?: string;
}

/** What the card shows: heading, the insight line, and the small context line. */
export interface EmployeeInsightCard {
  eyebrow: string;
  text: string;
  foot: string;
  /** Set when the foot line is a link (the career-history nudge). */
  footHref?: string;
}

interface Fact {
  sentence: string;
  weight: number;
  /** Facts about the same thing aren't shown together. */
  key: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const label = (p: PillarId) => PILLARS[p].label;

/** The option a score corresponds to (nearest, so a re-scored option still resolves). */
function optionText(h: AnswerHistory, score: number): string {
  return [...h.options].sort((a, b) => Math.abs(a.score - score) - Math.abs(b.score - score))[0]?.text ?? "";
}

/** Trailing run of identical answers. */
function trailingRun(answers: number[]): number {
  let n = 0;
  for (let i = answers.length - 1; i >= 0 && answers[i] === answers[answers.length - 1]; i--) n++;
  return n;
}

function shiftFact(h: AnswerHistory): Fact | null {
  const a = h.answers;
  if (a.length < 2 || a[a.length - 1] === a[a.length - 2] || h.weeksAgo > SHIFT_MAX_WEEKS_AGO) return null;
  const from = optionText(h, a[a.length - 2]);
  const to = optionText(h, a[a.length - 1]);
  if (!from || !to || from === to) return null;
  return {
    sentence: fill(COPY.insight.shift, { question: h.text, from, to }),
    weight: 60 + Math.abs(a[a.length - 1] - a[a.length - 2]) - 4 * h.weeksAgo,
    key: `q:${h.questionId}`,
  };
}

function streakFact(h: AnswerHistory): Fact | null {
  const run = trailingRun(h.answers);
  if (run < STREAK_MIN) return null;
  return {
    sentence: fill(COPY.insight.streak, {
      option: optionText(h, h.answers[h.answers.length - 1]),
      question: h.text,
      count: run,
    }),
    weight: 40 + run * 3,
    key: `q:${h.questionId}`,
  };
}

/** Pillar runs over the most recent weeks: above the cutoff, or lowest of all. */
function pillarRunFacts(trend: TrendPoint[]): Fact[] {
  const facts: Fact[] = [];
  for (const pid of PILLAR_ORDER) {
    let high = 0;
    for (let i = trend.length - 1; i >= 0; i--) {
      const v = trend[i][pid];
      if (v === null || v <= STRENGTH_CUTOFF) break;
      high++;
    }
    if (high >= PILLAR_RUN_MIN) {
      facts.push({
        sentence: fill(COPY.insight.pillarHigh, { pillar: label(pid), cutoff: STRENGTH_CUTOFF, weeks: plural(high, "week") }),
        weight: 45 + high,
        key: `p:${pid}`,
      });
    }
  }
  // Lowest pillar, week after week (only when it really is a concern).
  let lowest: PillarId | null = null;
  let run = 0;
  for (let i = trend.length - 1; i >= 0; i--) {
    const scored = PILLAR_ORDER.filter((p) => trend[i][p] !== null);
    if (scored.length < 2) break;
    const low = scored.reduce((a, b) => (trend[i][b]! < trend[i][a]! ? b : a));
    if (trend[i][low]! > STRENGTH_CUTOFF || (lowest && low !== lowest)) break;
    lowest = low;
    run++;
  }
  if (lowest && run >= PILLAR_RUN_MIN) {
    facts.push({
      sentence: fill(COPY.insight.pillarLowest, { pillar: label(lowest), weeks: plural(run, "week") }),
      weight: 50 + run,
      key: `p:${lowest}`,
    });
  }
  return facts;
}

/** What to say with only a few answers: the obvious, nothing more. */
function earlyFact(history: AnswerHistory[]): string | null {
  const latest = history
    .filter((h) => h.answers.length > 0)
    .map((h) => ({ h, score: h.answers[h.answers.length - 1] }));
  if (latest.length === 0) return null;
  const topScore = (h: AnswerHistory) => Math.max(...h.options.map((o) => o.score));
  if (latest.length >= 2 && latest.every(({ h, score }) => score === topScore(h))) {
    return COPY.insight.earlyAllTop;
  }
  const best = latest.reduce((a, b) => (b.score > a.score ? b : a));
  if (best.score > STRENGTH_CUTOFF) {
    return fill(COPY.insight.earlyBest, { option: optionText(best.h, best.score), question: best.h.text });
  }
  // Nothing above 7 yet: just say what they answered most recently, no verdict.
  const recent = latest.reduce((a, b) => (b.h.weeksAgo < a.h.weeksAgo ? b : a));
  return fill(COPY.insight.earlyLatest, { option: optionText(recent.h, recent.score), question: recent.h.text });
}

/** Plenty of answers, nothing moving: say it's steady and name the highest pillar. */
function steadyFact(trend: TrendPoint[], history: AnswerHistory[]): string | null {
  const byPillar = new Map<PillarId, number[]>();
  for (const h of history) byPillar.set(h.pillarId, [...(byPillar.get(h.pillarId) ?? []), ...h.answers]);
  const top = [...byPillar.entries()]
    .map(([p, xs]) => ({ p, avg: xs.reduce((a, b) => a + b, 0) / xs.length }))
    .sort((a, b) => b.avg - a.avg)[0];
  if (!top) return null;
  return fill(COPY.insight.steady, {
    weeks: plural(trend.length, "week"),
    pillar: label(top.p),
    score: (Math.round(top.avg * 10) / 10).toFixed(1),
  });
}

export function planInsight(input: SignalInput): InsightPlan {
  const { trend, history } = input;
  const answers = history.reduce((n, h) => n + h.answers.length, 0);
  const weeks = trend.length;
  const early = answers < EARLY_ANSWERS || weeks < 2;
  const name = input.firstName;

  // Foot: the context line under the insight — never advice.
  const foot: Pick<InsightPlan, "foot" | "footHref"> = early
    ? { foot: fill(COPY.insight.footEarly, { count: plural(answers, "answer") }) }
    : !input.hasCareerHistory
      ? { foot: COPY.insight.footCareer, footHref: "/career" }
      : { foot: fill(COPY.insight.footBasis, { count: plural(answers, "answer"), weeks: plural(weeks, "week") }) };

  if (early) {
    const line = earlyFact(history);
    return {
      eyebrow: fill(COPY.insight.eyebrowHappening, { name }),
      facts: line ? [line] : [],
      ...foot,
    };
  }

  // A sharp week-over-week move leads, with the pillar that moved most and,
  // if there is one, the answer that changed inside it.
  if (input.delta !== null && Math.abs(input.delta) >= BIG_CHANGE && weeks >= 2) {
    const last = trend[weeks - 1];
    const prev = trend[weeks - 2];
    const moves = PILLAR_ORDER.filter((p) => last[p] !== null && prev[p] !== null)
      .map((p) => ({ p, d: last[p]! - prev[p]! }))
      .filter((m) => Math.sign(m.d) === Math.sign(input.delta!))
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    if (moves.length > 0) {
      const { p, d } = moves[0];
      const facts = [
        fill(d < 0 ? COPY.insight.bigChangeDown : COPY.insight.bigChangeUp, {
          pillar: label(p),
          from: prev[p]!.toFixed(1),
          to: last[p]!.toFixed(1),
        }),
      ];
      const shift = history
        .filter((h) => h.pillarId === p)
        .map((h) => ({ h, f: shiftFact(h) }))
        .filter((x) => x.f && Math.sign(x.h.answers.at(-1)! - x.h.answers.at(-2)!) === Math.sign(d))
        .sort((a, b) => b.f!.weight - a.f!.weight)[0];
      if (shift) facts.push(shift.f!.sentence);
      return { eyebrow: fill(COPY.insight.eyebrowChanged, { name }), facts, ...foot };
    }
  }

  const candidates: Fact[] = [];
  for (const h of history) {
    const f = shiftFact(h) ?? streakFact(h);
    if (f) candidates.push(f);
  }
  candidates.push(...pillarRunFacts(trend));
  if (input.priorAction) {
    const a = input.priorAction;
    candidates.push({
      sentence: fill(a.movedUp ? COPY.insight.actionUp : COPY.insight.actionFlat, {
        pillar: label(a.pillarId),
        since: a.sinceLabel,
      }),
      weight: 58,
      key: `a:${a.pillarId}`,
    });
  }
  for (const c of input.careerExtremes) {
    candidates.push({
      sentence: fill(c.kind === "best" ? COPY.insight.careerBest : COPY.insight.careerWorst, { pillar: label(c.pillarId) }),
      weight: 47,
      key: `c:${c.pillarId}`,
    });
  }

  candidates.sort((a, b) => b.weight - a.weight);
  const picked: Fact[] = [];
  for (const c of candidates) {
    if (picked.length === 2) break;
    if (!picked.some((p) => p.key === c.key)) picked.push(c);
  }
  // Nothing notable (steady answers, no runs): say so plainly.
  const facts = picked.length > 0 ? picked.map((p) => p.sentence) : [steadyFact(trend, history)].filter((s): s is string => !!s);
  return { eyebrow: fill(COPY.insight.eyebrowHappening, { name }), facts, ...foot };
}
