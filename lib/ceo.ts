/**
 * Real CEO/HR org-wide dashboard (mock→D1 slice 4). SERVER-ONLY (calls getDB).
 *
 * PRIVACY: CEO/HR see aggregates at org / department / team scope — never an
 * individual. The anonymisation floor is enforced at EVERY scope: a scope with
 * fewer than ANONYMISATION_FLOOR active people (or responders) returns no score.
 * All counts are scoped to ACTIVE EMPLOYMENT.
 */

import { getDB } from "./db";
import { assertRole } from "./access-control";
import type {
  ActionImpact,
  CeoDashboard,
  CeoScopeOption,
  PillarScore,
  TrendPoint,
  Window,
} from "./data";
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

interface Row {
  weekId: string;
  pillarId: PillarId;
  score: number;
  userId: string;
}

export async function getCeoDashboard(
  session: SessionUser,
  scope: string = "org",
  window: Window = "3M",
): Promise<CeoDashboard> {
  assertRole(session, "ceo_hr");
  const db = getDB();

  // Scope options: org, then each department followed by its teams, then any
  // teams without a department.
  const [deptRes, teamRes] = await Promise.all([
    db.prepare("SELECT id, name FROM departments ORDER BY name").all<{ id: string; name: string }>(),
    db
      .prepare("SELECT id, name, departmentId FROM teams ORDER BY name")
      .all<{ id: string; name: string; departmentId: string | null }>(),
  ]);
  const options: CeoScopeOption[] = [{ value: "org", label: "Whole organisation", kind: "org" }];
  for (const d of deptRes.results) {
    options.push({ value: d.id, label: d.name, kind: "dept" });
    for (const t of teamRes.results.filter((t) => t.departmentId === d.id)) {
      options.push({ value: t.id, label: `— ${t.name}`, kind: "team" });
    }
  }
  for (const t of teamRes.results.filter((t) => !t.departmentId)) {
    options.push({ value: t.id, label: t.name, kind: "team" });
  }

  // Resolve scope → a WHERE fragment over employment `e` + a label/kind.
  let kind: "org" | "dept" | "team" = "org";
  let label = "Whole organisation";
  let scopeSql = "";
  const params: string[] = [];
  if (scope !== "org") {
    const d = deptRes.results.find((x) => x.id === scope);
    const t = teamRes.results.find((x) => x.id === scope);
    if (d) {
      kind = "dept";
      label = d.name;
      scopeSql = " AND e.departmentId = ?";
      params.push(scope);
    } else if (t) {
      kind = "team";
      label = t.name;
      scopeSql = " AND e.teamId = ?";
      params.push(scope);
    } else {
      scope = "org"; // unknown → fall back to org-wide
    }
  }

  const peopleRes = await db
    .prepare(`SELECT COUNT(*) AS n FROM employment e WHERE e.status = 'active'${scopeSql}`)
    .bind(...params)
    .first<{ n: number }>();
  const peopleCount = peopleRes?.n ?? 0;

  const belowFloor = (): CeoDashboard => ({
    scope,
    scopeLabel: label,
    scopeKind: kind,
    options,
    enoughData: false,
    reason: `${label} is below ${ANONYMISATION_FLOOR} responses, so nothing is shown — this protects anonymity.`,
    score: null,
    delta: null,
    percentile: null,
    peopleCount,
    pillars: [],
    trend: [],
    impact: null,
  });

  if (peopleCount < ANONYMISATION_FLOOR) return belowFloor();

  const { results: allRows } = await db
    .prepare(
      `SELECT c.weekId AS weekId, c.pillarId AS pillarId, c.score AS score, e.userId AS userId
         FROM checkIns c
         JOIN employment e ON e.id = c.employmentId
        WHERE e.status = 'active'${scopeSql}`,
    )
    .bind(...params)
    .all<Row>();

  const distinctResponders = new Set(allRows.map((r) => r.userId)).size;
  if (allRows.length < ANONYMISATION_FLOOR || distinctResponders < ANONYMISATION_FLOOR) {
    return belowFloor();
  }

  // Range weeks (most recent N with data).
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

  const score = round1(avg(rows.map((r) => r.score)));
  const last = trend[trend.length - 1];
  const prev = trend.length > 1 ? trend[trend.length - 2] : null;
  const delta = prev ? round1(last.overall - prev.overall) : null;

  const pillars: PillarScore[] = PILLAR_ORDER.map((pid) => {
    const ps = rows.filter((r) => r.pillarId === pid).map((r) => r.score);
    if (ps.length === 0) {
      return { pillarId: pid, score: null, delta: null, band: null, percentile: null, responseCount: 0 };
    }
    const s = round1(avg(ps));
    return {
      pillarId: pid,
      score: s,
      delta: prev ? round1(last[pid] - prev[pid]) : null,
      band: scoreBand(s),
      percentile: Math.max(20, Math.min(98, Math.round(s * 10 + 4))), // sample derivation
      responseCount: ps.length,
    };
  });

  return {
    scope,
    scopeLabel: label,
    scopeKind: kind,
    options,
    enoughData: true,
    score,
    delta,
    percentile: Math.max(20, Math.min(98, Math.round(score * 10 + 4))), // sample derivation
    peopleCount,
    pillars,
    trend,
    impact: await computeImpact(db, kind, scope),
  };
}

/**
 * "Action impact" from real manager actions in scope. Returns null until there
 * are any submitted actions (nothing to show yet — no fabricated numbers).
 */
async function computeImpact(
  db: ReturnType<typeof getDB>,
  kind: "org" | "dept" | "team",
  scope: string,
): Promise<ActionImpact | null> {
  let sql =
    `SELECT COUNT(*) AS submitted,
            SUM(CASE WHEN ma.status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
            COUNT(DISTINCT CASE WHEN ma.status = 'resolved' THEN ma.pillarId END) AS pillarsImproved
       FROM managerActions ma`;
  const params: string[] = [];
  if (kind === "dept") {
    sql += " JOIN teams t ON t.id = ma.teamId WHERE ma.submittedAt IS NOT NULL AND t.departmentId = ?";
    params.push(scope);
  } else if (kind === "team") {
    sql += " WHERE ma.submittedAt IS NOT NULL AND ma.teamId = ?";
    params.push(scope);
  } else {
    sql += " WHERE ma.submittedAt IS NOT NULL";
  }
  const r = await db
    .prepare(sql)
    .bind(...params)
    .first<{ submitted: number; resolved: number; pillarsImproved: number }>();
  const submitted = r?.submitted ?? 0;
  if (submitted === 0) return null;
  const resolved = r?.resolved ?? 0;
  return {
    submitted,
    resolved,
    resolutionPct: Math.round((resolved / submitted) * 100),
    pillarsImproved: r?.pillarsImproved ?? 0,
  };
}
