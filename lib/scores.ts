/**
 * Real individual-scores aggregation (mock→D1 slice 2). Own-data only.
 *
 * SERVER-ONLY (calls getDB) — never import from a client component. Screens read
 * these from server components; the client refreshes on window-change through the
 * server actions in app/(app)/dashboard/employee/actions.ts. Types stay in
 * lib/data.ts so client code can import them.
 *
 * Real: overall, per-pillar scores + deltas + response counts, the weekly trend
 * lines, per-question insights, response count and streak — all from this user's
 * own check-ins. Still sample (no source data yet): the org/dept/industry
 * benchmark lines, percentiles and participation — clearly marked below.
 */

import { getDB } from "./db";
import { assertOwner } from "./access-control";
import { getSampleRecommendation } from "./data";
import type {
  EmployeeScores,
  PillarScore,
  QuestionInsight,
  TrendPoint,
  Window,
} from "./data";
import { PILLAR_ORDER } from "./pillars";
import { scoreBand } from "./scoring";
import type { PillarId, SessionUser } from "./types";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** How many weeks each window spans. */
function weeksIn(window: Window): number {
  return { "1M": 4, "3M": 13, "6M": 26, "1Y": 52, All: 999 }[window];
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** An individual's single answer shows 100% on the option their score falls in. */
function singleAnswer(score: number): QuestionInsight["responses"] {
  const sel = score >= 7 ? "A" : score >= 4 ? "B" : "C";
  const text: Record<"A" | "B" | "C", string> = { A: "Positive", B: "Mixed", C: "Needs work" };
  return (["A", "B", "C"] as const).map((k) => ({ key: k, text: text[k], pct: k === sel ? 100 : 0 }));
}

interface CheckInRow {
  weekId: string;
  questionId: string;
  pillarId: PillarId;
  score: number;
}

/** Shared aggregation used by both the dashboard and a single pillar's detail. */
async function computeAggregate(userId: string, window: Window): Promise<EmployeeScores> {
  const db = getDB();
  const [ciRes, qRes, sRes, wRes] = await Promise.all([
    db
      .prepare("SELECT weekId, questionId, pillarId, score FROM checkIns WHERE userId = ?")
      .bind(userId)
      .all<CheckInRow>(),
    // Not filtered to isActive: a deactivated question's past answers still
    // belong in this person's own breakdown, or they silently vanish from it.
    db
      .prepare("SELECT id, text, pillarId FROM questions")
      .all<{ id: string; text: string; pillarId: PillarId }>(),
    db.prepare("SELECT currentStreak FROM streaks WHERE userId = ?").bind(userId).first<{
      currentStreak: number;
    }>(),
    db.prepare("SELECT weekId, startDate FROM weeklyWindows").all<{
      weekId: string;
      startDate: string;
    }>(),
  ]);

  const streak = sRes?.currentStreak ?? 0;
  const startById = new Map(wRes.results.map((w) => [w.weekId, w.startDate]));
  const orderKey = (wk: string) => startById.get(wk) ?? wk;

  // Restrict to the most recent N weeks that actually have answers.
  const distinctWeeks = [...new Set(ciRes.results.map((r) => r.weekId))].sort((a, b) =>
    orderKey(a).localeCompare(orderKey(b)),
  );
  const rangeWeeks = distinctWeeks.slice(-Math.min(weeksIn(window), distinctWeeks.length));
  const inRange = new Set(rangeWeeks);
  const rows = ciRes.results.filter((r) => inRange.has(r.weekId));

  // Sample-only fields (no benchmark/expected-response source yet).
  const sampleTail = {
    percentile: 72,
    percentiles: { org: 91, dept: 88, industry: 78 },
    participation: 86,
  };

  if (rows.length === 0) {
    return {
      enoughData: false,
      overall: null,
      delta: null,
      ...sampleTail,
      percentile: null,
      responseCount: 0,
      streak,
      pillars: PILLAR_ORDER.map((pillarId) => ({
        pillarId,
        score: null,
        delta: null,
        band: null,
        percentile: null,
        responseCount: 0,
      })),
      questions: [],
      trend: [],
    };
  }

  // Weekly trend (one point per week in range).
  const trend: TrendPoint[] = rangeWeeks.map((wk) => {
    const wkRows = rows.filter((r) => r.weekId === wk);
    const overall = round1(avg(wkRows.map((r) => r.score)));
    const pillarAvg = (pid: PillarId) => {
      const ps = wkRows.filter((r) => r.pillarId === pid).map((r) => r.score);
      return ps.length ? round1(avg(ps)) : overall;
    };
    return {
      weekId: wk,
      label: wk.replace("2026-", ""),
      overall,
      meaningful_work: pillarAvg("meaningful_work"),
      growth: pillarAvg("growth"),
      culture: pillarAvg("culture"),
      compensation: pillarAvg("compensation"),
      // Benchmarks aren't real yet — steady sample reference lines.
      orgAvg: 6.7,
      deptAvg: 6.9,
      industryAvg: 6.2,
    };
  });

  const overall = round1(avg(rows.map((r) => r.score)));
  const last = trend[trend.length - 1];
  const prev = trend.length > 1 ? trend[trend.length - 2] : null;
  const delta = prev ? round1(last.overall - prev.overall) : null;

  const pillars: PillarScore[] = PILLAR_ORDER.map((pid) => {
    const ps = rows.filter((r) => r.pillarId === pid).map((r) => r.score);
    if (ps.length === 0) {
      return { pillarId: pid, score: null, delta: null, band: null, percentile: null, responseCount: 0 };
    }
    const score = round1(avg(ps));
    return {
      pillarId: pid,
      score,
      delta: prev ? round1(last[pid] - prev[pid]) : null,
      band: scoreBand(score),
      percentile: Math.max(20, Math.min(98, Math.round(score * 10 + 4))), // sample derivation
      responseCount: ps.length,
    };
  });

  // Per-question insight: the user's average answer for each active question.
  const qMeta = new Map(qRes.results.map((q) => [q.id, q]));
  const byQ = new Map<string, number[]>();
  for (const r of rows) {
    const a = byQ.get(r.questionId) ?? [];
    a.push(r.score);
    byQ.set(r.questionId, a);
  }
  const questions: QuestionInsight[] = [...byQ.entries()]
    .filter(([qid]) => qMeta.has(qid))
    .map(([qid, scores]) => {
      const meta = qMeta.get(qid)!;
      const score = round1(avg(scores));
      return {
        id: qid,
        text: meta.text,
        pillarId: meta.pillarId,
        score,
        responses: singleAnswer(score),
        recommendation: getSampleRecommendation(meta.pillarId).text,
      };
    });

  return {
    enoughData: true,
    overall,
    delta,
    ...sampleTail,
    responseCount: rows.length,
    streak,
    pillars,
    questions,
    trend,
  };
}

/** An individual's own scores for a window. Own data only. */
export async function getEmployeeScores(
  session: SessionUser,
  userId: string,
  window: Window = "3M",
): Promise<EmployeeScores> {
  assertOwner(session, userId);
  return computeAggregate(userId, window);
}

export interface PillarDetail {
  pillarId: PillarId;
  score: number;
  delta: number;
  percentile: number;
  band: ReturnType<typeof scoreBand>;
  trend: TrendPoint[];
  questions: QuestionInsight[];
}

/** Detail for one pillar (the pillar-detail screen). Own data only. */
export async function getPillarDetail(
  session: SessionUser,
  userId: string,
  pillarId: PillarId,
  window: Window = "3M",
): Promise<PillarDetail> {
  assertOwner(session, userId);
  const agg = await computeAggregate(userId, window);
  const p = agg.pillars.find((x) => x.pillarId === pillarId);
  return {
    pillarId,
    score: p?.score ?? 0,
    delta: p?.delta ?? 0,
    percentile: p?.percentile ?? 0,
    band: p?.band ?? scoreBand(0),
    trend: agg.trend,
    questions: agg.questions.filter((q) => q.pillarId === pillarId),
  };
}
