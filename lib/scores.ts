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
 * own check-ins. Benchmarks (org/dept/industry lines, percentiles) have no real
 * source yet, so they're returned as null and hidden rather than invented.
 */

import { getDB } from "./db";
import { assertOwner } from "./access-control";
import { loadRecommendations, pickRecommendation } from "./recommendations";
import type {
  EmployeeScores,
  PillarScore,
  QuestionInsight,
  TrendPoint,
  Window,
} from "./data";
import { PILLAR_ORDER } from "./pillars";
import { isTrendReady, scoreBand } from "./scoring";
import { myBreakdown, type QuestionOptionCols } from "./responses";
import type { PillarId, SessionUser } from "./types";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** How many weeks each window spans. */
function weeksIn(window: Window): number {
  return { "1M": 4, "3M": 13, "6M": 26, "1Y": 52, All: 999 }[window];
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

interface CheckInRow {
  weekId: string;
  questionId: string;
  pillarId: PillarId;
  score: number;
  /** When it was answered (SQLite UTC "YYYY-MM-DD HH:MM:SS"). */
  timestamp: string;
}

/** Shared aggregation used by both the dashboard and a single pillar's detail. */
async function computeAggregate(userId: string, window: Window): Promise<EmployeeScores> {
  const db = getDB();
  const [ciRes, qRes, sRes, wRes, recMap] = await Promise.all([
    db
      // Oldest first, so a question's last answer is its most recent pick.
      .prepare("SELECT weekId, questionId, pillarId, score, timestamp FROM checkIns WHERE userId = ? ORDER BY timestamp, weekId")
      .bind(userId)
      .all<CheckInRow>(),
    // Not filtered to isActive: a deactivated question's past answers still
    // belong in this person's own breakdown, or they silently vanish from it.
    db
      .prepare(
        "SELECT id, text, pillarId, optionA_text, optionA_score, optionB_text, optionB_score, optionC_text, optionC_score FROM questions",
      )
      .all<{ id: string; text: string; pillarId: PillarId } & QuestionOptionCols>(),
    db.prepare("SELECT currentStreak FROM streaks WHERE userId = ?").bind(userId).first<{
      currentStreak: number;
    }>(),
    db.prepare("SELECT weekId, startDate FROM weeklyWindows").all<{
      weekId: string;
      startDate: string;
    }>(),
    loadRecommendations("employee"),
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

  // No benchmark / expected-response source yet — null, so screens hide these
  // instead of showing invented numbers.
  const sampleTail = {
    percentile: null,
    percentiles: { org: null, dept: null, industry: null },
    participation: 0,
  };

  if (rows.length === 0) {
    return {
      enoughData: false,
      overall: null,
      delta: null,
      ...sampleTail,
      percentile: null,
      responseCount: 0,
      totalAnswers: ciRes.results.length,
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
      trendReady: false,
    };
  }

  // Weekly trend (one point per week in range).
  const trend: TrendPoint[] = rangeWeeks.map((wk) => {
    const wkRows = rows.filter((r) => r.weekId === wk);
    const overall = round1(avg(wkRows.map((r) => r.score)));
    const pillarAvg = (pid: PillarId) => {
      const ps = wkRows.filter((r) => r.pillarId === pid).map((r) => r.score);
      return ps.length ? round1(avg(ps)) : null;
    };
    return {
      weekId: wk,
      label: wk.replace("2026-", ""),
      overall,
      meaningful_work: pillarAvg("meaningful_work"),
      growth: pillarAvg("growth"),
      culture: pillarAvg("culture"),
      compensation: pillarAvg("compensation"),
      // Benchmarks aren't real yet — hidden rather than shown as fake lines.
      orgAvg: null,
      deptAvg: null,
      industryAvg: null,
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
      delta: prev && last[pid] !== null && prev[pid] !== null ? round1(last[pid]! - prev[pid]!) : null,
      band: scoreBand(score),
      percentile: null, // no real benchmark yet
      responseCount: ps.length,
    };
  });

  // Per-question insight: the user's average answer for each active question.
  const qMeta = new Map(qRes.results.map((q) => [q.id, q]));
  const byQ = new Map<string, number[]>();
  const latestAt = new Map<string, string>(); // rows are oldest first
  for (const r of rows) {
    const a = byQ.get(r.questionId) ?? [];
    a.push(r.score);
    byQ.set(r.questionId, a);
    latestAt.set(r.questionId, r.timestamp);
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
        // Their real options, latest pick highlighted (oldest-first rows).
        ...myBreakdown(meta, scores, latestAt.get(qid) ?? null),
        recommendation: pickRecommendation(recMap, qid, meta.pillarId),
      };
    });

  return {
    enoughData: true,
    overall,
    delta,
    ...sampleTail,
    responseCount: rows.length,
    totalAnswers: ciRes.results.length,
    streak,
    pillars,
    questions,
    trend,
    trendReady: isTrendReady(startById.get(distinctWeeks[0])),
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
  /** null = no answers for this pillar yet (or below the anonymity floor). */
  score: number | null;
  delta: number | null;
  /** null until there's a real benchmark to compare against. */
  percentile: number | null;
  band: ReturnType<typeof scoreBand> | null;
  trend: TrendPoint[];
  /** Show the trend graph? False until this scope has 3 months of answers. */
  trendReady: boolean;
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
    score: p?.score ?? null,
    delta: p?.delta ?? null,
    percentile: p?.percentile ?? null,
    band: p?.band ?? null,
    trend: agg.trend,
    trendReady: agg.trendReady,
    questions: agg.questions.filter((q) => q.pillarId === pillarId),
  };
}
