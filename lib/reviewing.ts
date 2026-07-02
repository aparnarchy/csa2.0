/**
 * Real reviewing-manager views (mock→D1 slice 5). SERVER-ONLY (calls getDB).
 *
 * A reviewing-manager oversees managers/teams. There is no reviewer→manager
 * hierarchy table yet, so for the pilot they see every team that has a manager.
 * Each team's numbers come from getTeamAggregate (lib/team), which already
 * enforces the privacy rules: aggregates only, employment-scoped, ≥3 floor.
 * Below-floor teams surface with no score (never an individual).
 */

import { getDB } from "./db";
import { assertRole } from "./access-control";
import { getTeamAggregate } from "./team";
import type { ManagerDetail, ManagerSummary, ReviewingManagerList, Window } from "./data";
import { scoreBand } from "./scoring";
import type { SessionUser } from "./types";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function pctFromScore(score: number): number {
  return Math.max(20, Math.min(98, Math.round(score * 10 + 4)));
}

/** Resolution % from real manager actions for a team; null until any exist. */
async function teamResolutionPct(
  db: ReturnType<typeof getDB>,
  teamId: string,
): Promise<number | null> {
  const r = await db
    .prepare(
      `SELECT COUNT(*) AS submitted,
              SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved
         FROM managerActions WHERE teamId = ? AND submittedAt IS NOT NULL`,
    )
    .bind(teamId)
    .first<{ submitted: number; resolved: number }>();
  const submitted = r?.submitted ?? 0;
  if (submitted === 0) return null;
  return Math.round(((r?.resolved ?? 0) / submitted) * 100);
}

export async function getReviewingManagerList(
  session: SessionUser,
  window: Window = "3M",
): Promise<ReviewingManagerList> {
  assertRole(session, "reviewing_manager", "ceo_hr");
  const db = getDB();

  const { results: teams } = await db
    .prepare(
      `SELECT t.id AS teamId, t.managerId AS managerId, u.name AS name
         FROM teams t JOIN user u ON u.id = t.managerId
        ORDER BY u.name`,
    )
    .all<{ teamId: string; managerId: string; name: string }>();

  const managers: ManagerSummary[] = [];
  for (const t of teams) {
    const agg = await getTeamAggregate(session, t.teamId, window);
    if (!agg.enoughData || agg.teamScore === null) {
      managers.push({
        managerId: t.managerId,
        name: t.name,
        teamScore: null,
        delta: null,
        percentile: null,
        resolutionPct: null,
        band: null,
        enoughData: false,
      });
    } else {
      managers.push({
        managerId: t.managerId,
        name: t.name,
        teamScore: agg.teamScore,
        delta: agg.delta,
        percentile: pctFromScore(agg.teamScore),
        resolutionPct: await teamResolutionPct(db, t.teamId),
        band: scoreBand(agg.teamScore),
        enoughData: true,
      });
    }
  }

  const shown = managers.filter((m) => m.enoughData && m.teamScore !== null);
  const orgAvg = shown.length
    ? round1(shown.reduce((s, m) => s + (m.teamScore ?? 0), 0) / shown.length)
    : null;
  managers.sort(
    (a, b) => Number(b.enoughData) - Number(a.enoughData) || (b.teamScore ?? 0) - (a.teamScore ?? 0),
  );

  return { orgAvg, managerCount: managers.length, shownCount: shown.length, managers };
}

export async function getReviewingManagerDetail(
  session: SessionUser,
  managerId: string,
  window: Window = "3M",
): Promise<ManagerDetail> {
  assertRole(session, "reviewing_manager", "ceo_hr");
  const db = getDB();

  const team = await db
    .prepare(
      `SELECT t.id AS teamId, u.name AS name
         FROM teams t JOIN user u ON u.id = t.managerId
        WHERE t.managerId = ? LIMIT 1`,
    )
    .bind(managerId)
    .first<{ teamId: string; name: string }>();

  if (!team) {
    return {
      managerId,
      name: "Unknown manager",
      enoughData: false,
      reason: "No team found for this manager.",
      teamScore: null,
      delta: null,
      percentile: null,
      resolutionPct: null,
      pillars: [],
      trend: [],
    };
  }

  const agg = await getTeamAggregate(session, team.teamId, window);
  if (!agg.enoughData || agg.teamScore === null) {
    return {
      managerId,
      name: team.name,
      enoughData: false,
      reason: agg.reason,
      teamScore: null,
      delta: null,
      percentile: null,
      resolutionPct: null,
      pillars: [],
      trend: [],
    };
  }

  return {
    managerId,
    name: team.name,
    enoughData: true,
    teamScore: agg.teamScore,
    delta: agg.delta,
    percentile: pctFromScore(agg.teamScore),
    resolutionPct: await teamResolutionPct(db, team.teamId),
    pillars: agg.pillars,
    trend: agg.trend,
  };
}
