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
import { questionTitle } from "./question-titles";

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
  /** True when a sharp week-over-week move leads the card. */
  changed: boolean;
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
      changed: false,
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
      return { eyebrow: fill(COPY.insight.eyebrowChanged, { name }), changed: true, facts, ...foot };
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
  return { eyebrow: fill(COPY.insight.eyebrowHappening, { name }), changed: false, facts, ...foot };
}

// ─────────────────────────────────────────────────────────────────────────────
// The fact sheet the AI reads (owner, 2026-10-09: "smart and sharp — find
// patterns across everything they've told us"). Everything a sharp observer
// would want, with the comparisons already worked out, so the AI connects
// facts and says what they suggest without doing arithmetic or inventing
// numbers. planInsight() above still supplies the heading, the context line,
// and the plain fallback sentence for when the AI is unavailable.
// ─────────────────────────────────────────────────────────────────────────────

export interface CareerJob {
  name: string;
  role: string | null;
  months: number;
  overall: number | null;
  pillars: Partial<Record<PillarId, number>>;
}

export interface SheetInput {
  history: AnswerHistory[];
  /** This job's pillar averages for the window (null = no answers). */
  pillars: Partial<Record<PillarId, number | null>>;
  overall: number;
  weeks: number;
  profile: {
    designation: string | null;
    grade: string | null;
    department: string | null;
    company: string | null;
    /** Months at the current company (0 = unknown). */
    months: number;
  };
  pastJobs: CareerJob[];
  priorAction: SignalInput["priorAction"];
}

/** 50 → "4 years 2 months". */
export function durationLabel(months: number): string {
  if (months <= 0) return "";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? plural(y, "year") : "", m ? plural(m, "month") : ""].filter(Boolean).join(" ");
}

/** Whole months between two ISO dates (end defaults to today). */
export function monthsBetween(start: string | null, end: string | null = null): number {
  if (!start) return 0;
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  return Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
}

const r1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
const avgOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Longest reply accepted from the AI; anything longer isn't "short". */
const MAX_AI_CHARS = 320;
/** The AI is told never to advise; this catches it if it does anyway. */
const ADVICE = /\b(try|consider|recommend|make sure|why not|you could|you might want|it's worth|talk to|ask your)\b/i;

export const INSIGHT_SYSTEM_PROMPT = [
  "You write the insight at the top of someone's own workplace-happiness dashboard, addressed to them as \"you\".",
  "The app has already found the patterns worth mentioning (ANGLES), each with a note on what it often means.",
  "Pick the single most interesting angle, or two that clearly belong together. Write what you notice in plain words,",
  "then what it suggests, putting the meaning note in your own words.",
  "",
  "Rules:",
  "- One or two short sentences, at most 35 words.",
  "- Use only the sheet. Add no numbers, causes, feelings or facts of your own, and don't tie one pillar to another unless an angle does.",
  "- Never give advice, instructions or next steps.",
  "- Quote answer options exactly, in quotation marks. Shorten a question to its topic",
  "  (\"Are you learning new skills in your current role?\" becomes learning new skills).",
  "- With very little data, keep what it suggests modest.",
  "- Plain, warm British English. No emojis, headings or lists; don't start with their name.",
  "",
  "The examples below are about other people. Never reuse their details.",
  "Good: Your team works \"Very well\" together, yet good work is \"Rarely\" recognised. Days probably feel fine, but that kind of gap tends to wear people down quietly.",
  "Good: Meaningful Work has topped three jobs in a row, this one included. It looks like the thing you go looking for in any role.",
  "Bad (restates a score): Your Growth score is 8.4, which is a strength.",
  "Bad (advice): Try asking your manager about promotion paths.",
  "Bad (generic): You have some strengths and some areas to work on.",
].join("\n");

/** Every number in the AI's reply must appear in the fact sheet, or it made one
 *  up. "10" is fine for "10.0", the same number written without its decimal. */
function numbersCheckOut(text: string, sheet: string): boolean {
  const known = new Set<string>();
  for (const n of sheet.match(/\d+(?:\.\d+)?/g) ?? []) {
    known.add(n);
    if (n.endsWith(".0")) known.add(n.slice(0, -2));
  }
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).every((n) => known.has(n));
}

/** The AI's reply is usable: short, one paragraph, no advice, no made-up numbers. */
export function aiReplyOk(text: string, sheet: string): boolean {
  return text.length <= MAX_AI_CHARS && !text.includes("\n") && !ADVICE.test(text) && numbersCheckOut(text, sheet);
}

/** One pattern worth telling them about: the fact (second person, so it can
 *  stand alone as the fallback line) and what that pattern usually means. */
export interface Angle {
  weight: number;
  fact: string;
  meaning: string;
  /** "gap" = strongest vs weakest pillar (the summary line already says it). */
  kind?: "gap";
}

const SENIOR = /\b(senior|sr\.?|lead|principal|staff|head|manager|director|architect|vp)\b/i;

/** Within a pillar, what a high part next to a low part usually means. */
const SPLIT_MEANING: Record<PillarId, string> = {
  meaningful_work:
    "When the work itself engages someone but its purpose doesn't (or the reverse), the weaker side is usually what decides whether the job feels worth it.",
  growth:
    "Learning a lot without a visible way up (or a clear path without real learning) is the classic 'growing but not going anywhere' pattern, and a common reason people start looking around.",
  culture:
    "A team that works well together but doesn't recognise or feel safe with each other usually feels fine day to day and draining over time.",
  compensation:
    "When pay and benefits disagree, it's usually one specific part of the package, not money in general, that's shaping how fair it feels.",
};

/** The patterns in their data worth an insight, strongest first. */
const SPLIT_ANGLE_ON = false;

export function findAngles(input: SheetInput): Angle[] {
  const { history, profile, pillars } = input;
  const angles: Angle[] = [];
  const answers = history.reduce((n, h) => n + h.answers.length, 0);
  const quote = (h: AnswerHistory) => `“${optionText(h, h.answers.at(-1)!)}”`;
  const scored = PILLAR_ORDER.filter((p) => pillars[p] != null) as PillarId[];

  // 1. Parts of one pillar that disagree. SWITCHED OFF (owner, 2026-10-15):
  // any two questions in a pillar aren't necessarily opposites, and the
  // per-pillar explanation rarely fitted the pair it was shown with. Comes
  // back only with per-question phrasing the owner approves.
  for (const pid of SPLIT_ANGLE_ON ? PILLAR_ORDER : []) {
    const qs = history.filter((h) => h.pillarId === pid && h.answers.length > 0).map((h) => ({ h, avg: avgOf(h.answers) }));
    if (qs.length < 2) continue;
    const hi = qs.reduce((a, b) => (b.avg > a.avg ? b : a));
    const lo = qs.reduce((a, b) => (b.avg < a.avg ? b : a));
    if (hi.avg - lo.avg < 3) continue;
    angles.push({
      weight: 80 + (hi.avg - lo.avg),
      fact: `Inside ${label(pid)}, you answer ${quote(hi.h)} to “${hi.h.text}” but ${quote(lo.h)} to “${lo.h.text}”.`,
      meaning: SPLIT_MEANING[pid],
    });
  }

  // 2. Their time and seniority against how they feel.
  const growth = pillars.growth;
  const culture = pillars.culture;
  const senior = profile.designation ? SENIOR.test(profile.designation) : false;
  if (profile.months >= 36 && growth != null && growth <= STRENGTH_CUTOFF) {
    angles.push({
      weight: 78,
      fact: `You've been here ${durationLabel(profile.months)}${profile.designation ? ` as ${profile.designation}` : ""}, and Growth is a concern at ${r1(growth)}.`,
      meaning: "Several years in with Growth low is the classic plateau: the job is known and comfortable, but it has stopped moving you forward.",
    });
  }
  if (profile.months > 0 && profile.months <= 6 && input.overall > STRENGTH_CUTOFF) {
    angles.push({
      weight: 70,
      fact: `You joined ${durationLabel(profile.months)} ago and you're scoring ${r1(input.overall)} overall.`,
      meaning: "The first months often read high while everything is new; the next few months show which parts of this hold.",
    });
  }
  if (profile.months >= 36 && input.overall > 8) {
    angles.push({
      weight: 66,
      fact: `${durationLabel(profile.months)} in, you're still scoring ${r1(input.overall)} overall.`,
      meaning: "Staying this positive years into a job is less common than it sounds; it usually means the job still fits what you value.",
    });
  }
  if (senior && culture != null && culture <= STRENGTH_CUTOFF) {
    angles.push({
      weight: 68,
      fact: `As ${profile.designation}, your Culture score is a concern at ${r1(culture)}.`,
      meaning: "Senior people often feel least recognised: their wins show up as the team's, and fewer people tell them they did well.",
    });
  }

  // 3. Strongest against weakest pillar.
  if (scored.length >= 2) {
    const top = scored.reduce((a, b) => (pillars[b]! > pillars[a]! ? b : a));
    const low = scored.reduce((a, b) => (pillars[b]! < pillars[a]! ? b : a));
    if (pillars[top]! - pillars[low]! >= 3 && pillars[top]! > STRENGTH_CUTOFF && pillars[low]! <= STRENGTH_CUTOFF) {
      angles.push({
        kind: "gap",
        weight: 60 + (pillars[top]! - pillars[low]!),
        fact: `${label(top)} is your strongest pillar at ${r1(pillars[top]!)}, and ${label(low)} your weakest at ${r1(pillars[low]!)}.`,
        meaning: `A strong pillar is usually what keeps someone engaged; a weak one is usually what makes them restless. Here that's ${label(top)} against ${label(low)}.`,
      });
    }
  }

  // 4. Career: what follows them from job to job, and how this one differs.
  const jobs = input.pastJobs.filter((j) => Object.keys(j.pillars).length > 0);
  if (jobs.length > 0) {
    const all = [...jobs.map((j) => j.pillars), pillars];
    const tally = (pick: "top" | "bottom") => {
      const counts = new Map<PillarId, number>();
      for (const ps of all) {
        const sc = PILLAR_ORDER.filter((p) => ps[p] != null);
        if (sc.length < 2) continue;
        const best = sc.reduce((a, b) => ((pick === "top" ? ps[b]! > ps[a]! : ps[b]! < ps[a]!) ? b : a));
        counts.set(best, (counts.get(best) ?? 0) + 1);
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    };
    const [topP, topN] = tally("top") ?? [];
    if (topP && topN && topN >= 2) {
      angles.push({
        weight: 72 + topN,
        fact: `${label(topP)} has been your strongest pillar at ${topN} of the ${all.length} jobs you've told us about, this one included.`,
        meaning: "A pillar that comes out on top job after job is usually what you look for in any role, whether you've named it or not.",
      });
    }
    const [lowP, lowN] = tally("bottom") ?? [];
    if (lowP && lowN && lowN >= 2) {
      angles.push({
        weight: 74 + lowN,
        fact: `${label(lowP)} has been your weakest pillar at ${lowN} of the ${all.length} jobs you've told us about, this one included.`,
        meaning: "A gap that follows someone from job to job is usually about what they need rather than any one company.",
      });
    }
    for (const pid of scored) {
      const past = jobs.map((j) => j.pillars[pid]).filter((x): x is number => x !== undefined);
      if (past.length === 0) continue;
      const d = pillars[pid]! - avgOf(past);
      if (Math.abs(d) < 2) continue;
      angles.push({
        weight: 62 + Math.abs(d),
        fact: `${label(pid)} here is ${r1(pillars[pid]!)}, against ${r1(avgOf(past))} on average at your past jobs.`,
        meaning:
          d > 0
            ? "When one pillar is clearly better than anywhere you've been, it's often the real reason this job works for you."
            : "When one pillar is clearly worse than anywhere you've been, it tends to stand out more the longer you stay.",
      });
    }
  }

  // 5. Direction and consistency.
  for (const pid of scored) {
    const xs = history.filter((h) => h.pillarId === pid).flatMap((h) => h.answers);
    if (xs.length < 4) continue;
    const half = Math.floor(xs.length / 2);
    const d = avgOf(xs.slice(half)) - avgOf(xs.slice(0, half));
    if (Math.abs(d) < 1.5) continue;
    angles.push({
      weight: 64 + Math.abs(d),
      fact: `Your ${label(pid)} answers have ${d > 0 ? "risen" : "fallen"} from about ${r1(avgOf(xs.slice(0, half)))} to ${r1(avgOf(xs.slice(half)))}.`,
      meaning: d > 0 ? "A steady climb usually reflects something that actually changed, not a good week." : "A steady slide usually starts well before anyone says it out loud.",
    });
  }
  for (const h of history) {
    if (h.answers.length >= 3 && trailingRun(h.answers) >= 3) {
      angles.push({
        weight: 50 + h.answers.length,
        fact: `Your answer on ${questionTitle(h.questionId, h.text)} has been ${quote(h)} ${plural(trailingRun(h.answers), "time")} in a row.`,
        meaning: "An answer that never moves is a settled view, not a mood.",
      });
    }
  }

  if (input.priorAction) {
    const a = input.priorAction;
    angles.push({
      weight: 76,
      fact: `Your manager acted on ${label(a.pillarId)} ${a.sinceLabel}, and your ${label(a.pillarId)} answers have ${a.movedUp ? "gone up" : "not gone up"} since.`,
      meaning: a.movedUp
        ? "Feedback that visibly changes something is rarer than it should be; this is it working."
        : "When a change hasn't moved how you feel, it usually missed what was really behind the low answers.",
    });
  }

  // With very little data, only the most concrete patterns are fair to raise.
  const out = angles.sort((a, b) => b.weight - a.weight);
  return answers < EARLY_ANSWERS ? out.filter((a) => a.weight >= 78).slice(0, 2) : out.slice(0, 5);
}

/** What the AI reads: who they are, how much data there is, the pillars, and the angles. */
export function angleSheet(input: SheetInput, angles: Angle[]): string {
  const { profile } = input;
  const answers = input.history.reduce((n, h) => n + h.answers.length, 0);
  const who = [
    profile.designation && `role: ${profile.designation}`,
    profile.grade && `grade: ${profile.grade}`,
    profile.department && `department: ${profile.department}`,
    profile.months > 0 && `at this company ${durationLabel(profile.months)}`,
  ].filter(Boolean);
  const pillarLine = PILLAR_ORDER.filter((p) => input.pillars[p] != null)
    .map((p) => `${label(p)} ${r1(input.pillars[p]!)}`)
    .join(", ");
  return [
    who.length ? `ABOUT THEM: ${who.join("; ")}.` : null,
    `AMOUNT OF DATA: ${plural(answers, "answer")} over ${plural(input.weeks, "week")}${answers < EARLY_ANSWERS ? " (very little)" : ""}.`,
    `PILLARS (above ${STRENGTH_CUTOFF} is a strength, ${STRENGTH_CUTOFF} or below a concern): ${pillarLine}.`,
    ...angles.map((a, i) => `ANGLE ${i + 1}: ${a.fact}\nWHAT IT OFTEN MEANS: ${a.meaning}`),
  ]
    .filter(Boolean)
    .join("\n");
}
