/**
 * Real team-aggregate for managers (mock→D1 slice 3). SERVER-ONLY (calls getDB).
 *
 * PRIVACY — enforced here in server code, never in the UI:
 *  - Managers can only ever see THEIR OWN team (a passed teamId is ignored for a
 *    plain manager; reviewing-managers / CEO-HR may target a specific team).
 *  - Aggregates only — never an individual's score or identity is returned.
 *  - Reportees and responses are scoped to ACTIVE EMPLOYMENT (via employmentId),
 *    so only check-ins made while someone was on the team count.
 *  - The anonymisation floor is enforced: nothing is returned unless there are
 *    at least ANONYMISATION_FLOOR (3) reportees AND at least 3 distinct people
 *    who responded. Below that we return an explicit "not enough data" result.
 */

import { getDB } from "./db";
import { assertRole } from "./access-control";
import { getSampleRecommendation } from "./data";
import type { PillarScore, QuestionInsight, TeamAggregate, TrendPoint, Window } from "./data";
import { PILLAR_ORDER } from "./pillars";
import { ANONYMISATION_FLOOR, scoreBand } from "./scoring";
import type { PillarId, SessionUser } from "./types";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function weeksIn(window: Window): number {
  return { "1M": 4, "3M": 13, "6M": 26, "1Y": 52, All: 999 }[window];
}
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

interface TeamRow {
  weekId: string;
  pillarId: PillarId;
  score: number;
  userId: string;
}

export async function getTeamAggregate(
  session: SessionUser,
  teamId: string,
  window: Window = "3M",
): Promise<TeamAggregate> {
  assertRole(session, "manager", "ceo_hr");
  const db = getDB();

  const floorReason = `Need at least ${ANONYMISATION_FLOOR} reportees with responses to show team data.`;
  const empty: TeamAggregate = {
    enoughData: false,
    reason: floorReason,
    teamScore: null,
    delta: null,
    participation: 0,
    reporteeCount: 0,
    pillars: [],
    trend: [],
  };

  // A plain manager is always scoped to the team they manage, whatever teamId
  // was passed. Only CEO/HR may target another team.
  const elevated = session.roles.includes("ceo_hr");
  let resolvedTeamId: string | null = teamId;
  if (teamId === "my-team" || !elevated) {
    const t = await db
      .prepare("SELECT id FROM teams WHERE managerId = ? LIMIT 1")
      .bind(session.id)
      .first<{ id: string }>();
    resolvedTeamId = t?.id ?? null;
  }
  if (!resolvedTeamId) return empty;

  // Reportees = active employments on the team.
  const memRes = await db
    .prepare("SELECT COUNT(*) AS n FROM employment WHERE teamId = ? AND status = 'active'")
    .bind(resolvedTeamId)
    .first<{ n: number }>();
  const reporteeCount = memRes?.n ?? 0;
  if (reporteeCount < ANONYMISATION_FLOOR) return { ...empty, reporteeCount };

  // Team check-ins, scoped to active employment (so only during-employment counts).
  const { results: allRows } = await db
    .prepare(
      `SELECT c.weekId AS weekId, c.pillarId AS pillarId, c.score AS score, e.userId AS userId
         FROM checkIns c
         JOIN employment e ON e.id = c.employmentId
        WHERE e.teamId = ? AND e.status = 'active'`,
    )
    .bind(resolvedTeamId)
    .all<TeamRow>();

  // Anonymisation floor on responses: need >=3 responses from >=3 distinct people.
  const distinctResponders = new Set(allRows.map((r) => r.userId)).size;
  if (allRows.length < ANONYMISATION_FLOOR || distinctResponders < ANONYMISATION_FLOOR) {
    return { ...empty, reporteeCount };
  }

  // Restrict to the most recent N weeks that have responses.
  const wRes = await db.prepare("SELECT weekId, startDate FROM weeklyWindows").all<{
    weekId: string;
    startDate: string;
  }>();
  const startById = new Map(wRes.results.map((w) => [w.weekId, w.startDate]));
  const orderKey = (wk: string) => startById.get(wk) ?? wk;
  const distinctWeeks = [...new Set(allRows.map((r) => r.weekId))].sort((a, b) =>
    orderKey(a).localeCompare(orderKey(b)),
  );
  const rangeWeeks = distinctWeeks.slice(-Math.min(weeksIn(window), distinctWeeks.length));
  const inRange = new Set(rangeWeeks);
  const rows = allRows.filter((r) => inRange.has(r.weekId));

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
      orgAvg: 6.7,
      deptAvg: 6.9,
      industryAvg: 6.2,
    };
  });

  const teamScore = round1(avg(rows.map((r) => r.score)));
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

  // Real participation: distinct responders this window / reportees.
  const rangeResponders = new Set(rows.map((r) => r.userId)).size;
  const participation = Math.min(100, Math.round((rangeResponders / reporteeCount) * 100));

  return { enoughData: true, teamScore, delta, participation, reporteeCount, pillars, trend };
}

interface TeamQuestionRow {
  id: string;
  text: string;
  pillarId: PillarId;
  optionA_text: string;
  optionA_score: number;
  optionB_text: string;
  optionB_score: number;
  optionC_text: string;
  optionC_score: number;
}

/** Real A/B/C split for a question from the team's answers (score → option). */
function distribution(scores: number[], q: TeamQuestionRow): QuestionInsight["responses"] {
  const opts = [
    { key: "A" as const, text: q.optionA_text, score: q.optionA_score },
    { key: "B" as const, text: q.optionB_text, score: q.optionB_score },
    { key: "C" as const, text: q.optionC_text, score: q.optionC_score },
  ];
  const total = scores.length || 1;
  return opts.map((o) => ({
    key: o.key,
    text: o.text,
    pct: Math.round((scores.filter((s) => s === o.score).length / total) * 100),
  }));
}

export interface TeamPillarDetail {
  pillarId: PillarId;
  score: number;
  delta: number;
  percentile: number;
  band: ReturnType<typeof scoreBand>;
  trend: TrendPoint[];
  questions: QuestionInsight[];
}

/**
 * Team-level detail for one pillar (the pillar-detail screen, reached by tapping
 * a pillar card on the manager dashboard — same shape as the employee's, but
 * aggregated). Reuses getTeamAggregate for the score/trend, then re-derives
 * per-question team distributions. Anonymised per-question too: a question is
 * only included if at least ANONYMISATION_FLOOR distinct people answered it —
 * the overall pillar can clear the team floor while one specific question in it
 * doesn't.
 */
export async function getTeamPillarDetail(
  session: SessionUser,
  teamId: string,
  pillarId: PillarId,
  window: Window = "3M",
): Promise<TeamPillarDetail> {
  assertRole(session, "manager", "ceo_hr");
  const agg = await getTeamAggregate(session, teamId, window);
  const p = agg.pillars.find((x) => x.pillarId === pillarId);
  const empty: TeamPillarDetail = {
    pillarId,
    score: p?.score ?? 0,
    delta: p?.delta ?? 0,
    percentile: p?.percentile ?? 0,
    band: p?.band ?? scoreBand(0),
    trend: agg.trend,
    questions: [],
  };
  if (!agg.enoughData || p?.score == null) return empty;

  const db = getDB();
  const elevated = session.roles.includes("ceo_hr");
  let resolvedTeamId: string | null = teamId;
  if (teamId === "my-team" || !elevated) {
    const t = await db
      .prepare("SELECT id FROM teams WHERE managerId = ? LIMIT 1")
      .bind(session.id)
      .first<{ id: string }>();
    resolvedTeamId = t?.id ?? null;
  }
  if (!resolvedTeamId) return empty;

  const [{ results: qRows }, { results: ciRows }] = await Promise.all([
    // Not filtered to isActive: a deactivated question's past team answers
    // still belong in this breakdown, or they silently vanish from it.
    db.prepare("SELECT * FROM questions WHERE pillarId = ?").bind(pillarId).all<TeamQuestionRow>(),
    db
      .prepare(
        `SELECT c.questionId AS questionId, c.score AS score, e.userId AS userId
           FROM checkIns c JOIN employment e ON e.id = c.employmentId
          WHERE e.teamId = ? AND e.status = 'active' AND c.pillarId = ?`,
      )
      .bind(resolvedTeamId, pillarId)
      .all<{ questionId: string; score: number; userId: string }>(),
  ]);

  const byQ = new Map<string, number[]>();
  const respondersByQ = new Map<string, Set<string>>();
  for (const r of ciRows) {
    (byQ.get(r.questionId) ?? byQ.set(r.questionId, []).get(r.questionId)!).push(r.score);
    (respondersByQ.get(r.questionId) ?? respondersByQ.set(r.questionId, new Set()).get(r.questionId)!).add(r.userId);
  }

  const questions: QuestionInsight[] = qRows
    .filter((q) => (respondersByQ.get(q.id)?.size ?? 0) >= ANONYMISATION_FLOOR)
    .map((q) => {
      const scores = byQ.get(q.id)!;
      const score = round1(avg(scores));
      return {
        id: q.id,
        text: q.text,
        pillarId: q.pillarId,
        score,
        responses: distribution(scores, q),
        recommendation: getSampleRecommendation(q.pillarId).text,
      };
    });

  return { ...empty, questions };
}
