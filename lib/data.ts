/**
 * The single data-access layer. EVERY screen reads through these functions —
 * never directly from the database. Each one runs through the Phase 1
 * access-control guards, so privacy is enforced here in server code.
 *
 * For now these return realistic SAMPLE data so screens can be built and
 * eyeballed. In later phases we swap the *insides* for real D1 queries with
 * no change to the function signatures or the shapes screens consume.
 */

import type { PillarId, SessionUser } from "./types";
import { PILLAR_ORDER } from "./pillars";
import {
  assertOwner,
  assertRole,
  enforceAnonymisationFloor,
} from "./access-control";
import { ANONYMISATION_FLOOR, scoreBand, trendDelta, type ScoreResult } from "./scoring";

/** Time filter used by the analysis screens. */
export type Window = "1M" | "3M" | "6M" | "1Y" | "All";
export const WINDOWS: Window[] = ["1M", "3M", "6M", "1Y", "All"];

/** One pillar's headline numbers for a card. */
export interface PillarScore {
  pillarId: PillarId;
  score: number | null;
  delta: number | null;
  band: "green" | "amber" | "red" | null;
  responseCount: number;
}

/** One point on a trend chart (overall + each pillar + reference lines). */
export interface TrendPoint {
  weekId: string;
  label: string;
  overall: number;
  meaningful_work: number;
  growth: number;
  culture: number;
  compensation: number;
  orgAvg: number;
  industryAvg: number;
}

/** Everything the employee analysis screen needs. */
export interface EmployeeScores {
  enoughData: boolean;
  overall: number | null;
  delta: number | null;
  percentile: number | null;
  participation: number; // %
  responseCount: number;
  streak: number;
  pillars: PillarScore[];
  trend: TrendPoint[];
}

/** Aggregated team view for a manager (no individuals, ever). */
export interface TeamAggregate {
  enoughData: boolean;
  reason?: string;
  teamScore: number | null;
  delta: number | null;
  participation: number;
  reporteeCount: number;
  pillars: PillarScore[];
  trend: TrendPoint[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic sample-data helpers (replaced by D1 queries later)
// ─────────────────────────────────────────────────────────────────────────────

/** Stable pseudo-random in [0,1) from a string seed — keeps sample data steady. */
function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** How many weeks a window spans (sample approximation). */
function weeksIn(window: Window): number {
  return { "1M": 4, "3M": 13, "6M": 26, "1Y": 52, All: 64 }[window];
}

const RECENT_WEEKS = [
  "2026-W13", "2026-W14", "2026-W15", "2026-W16", "2026-W17", "2026-W18",
  "2026-W19", "2026-W20", "2026-W21", "2026-W22", "2026-W23", "2026-W24",
];

/** Build a believable wavy trend series ending near `target`. */
function buildTrend(seedKey: string, target: number, points: number): TrendPoint[] {
  const weeks = RECENT_WEEKS.slice(-points);
  return weeks.map((weekId, i) => {
    const wobble = (seeded(seedKey + weekId) - 0.5) * 1.6;
    const drift = (i / weeks.length) * 1.2; // gentle improvement over time
    const overall = Math.min(10, Math.max(1, round1(target - 1.2 + drift + wobble)));
    const p = (pid: PillarId, offset: number) =>
      Math.min(10, Math.max(1, round1(overall + offset + (seeded(seedKey + pid + weekId) - 0.5))));
    return {
      weekId,
      label: weekId.replace("2026-", ""),
      overall,
      meaningful_work: p("meaningful_work", 0.4),
      growth: p("growth", -0.6),
      culture: p("culture", 0.8),
      compensation: p("compensation", -0.9),
      orgAvg: round1(6.6 + (seeded("org" + weekId) - 0.5) * 0.4),
      industryAvg: 6.2,
    };
  });
}

function pillarScoresFrom(trend: TrendPoint[]): PillarScore[] {
  const last = trend[trend.length - 1];
  const prev = trend.length > 1 ? trend[trend.length - 2] : null;
  return PILLAR_ORDER.map((pillarId) => {
    const score = last[pillarId];
    const delta = prev ? round1(score - prev[pillarId]) : null;
    return {
      pillarId,
      score,
      delta,
      band: scoreBand(score),
      responseCount: 6 + Math.floor(seeded(pillarId + last.weekId) * 8),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public data functions (every screen calls these)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An individual's own scores for a window. A user may only read their own
 * data — enforced by assertOwner. Managers cannot reach individual scores here.
 */
export async function getEmployeeScores(
  session: SessionUser,
  userId: string,
  window: Window = "3M"
): Promise<EmployeeScores> {
  assertOwner(session, userId);

  const points = Math.min(weeksIn(window), RECENT_WEEKS.length);
  const trend = buildTrend(userId, 7.1, points);
  const overall = trend[trend.length - 1].overall;
  const prior = trend.length > 1 ? trend[trend.length - 2].overall : null;

  return {
    enoughData: true,
    overall,
    delta: prior === null ? null : round1(overall - prior),
    percentile: 72,
    participation: 86,
    responseCount: points * 2,
    streak: 4,
    pillars: pillarScoresFrom(trend),
    trend,
  };
}

/** Detail for one pillar (used by the pillar-detail screen). Own data only. */
export async function getPillarDetail(
  session: SessionUser,
  userId: string,
  pillarId: PillarId,
  window: Window = "3M"
) {
  assertOwner(session, userId);
  const points = Math.min(weeksIn(window), RECENT_WEEKS.length);
  const trend = buildTrend(userId + pillarId, 6.8, points);
  const score = trend[trend.length - 1][pillarId];
  const prior = trend.length > 1 ? trend[trend.length - 2][pillarId] : null;

  return {
    pillarId,
    score,
    delta: prior === null ? null : round1(score - prior),
    percentile: 64,
    band: scoreBand(score),
    trend,
    questions: [
      { id: "q1", text: "Do you get opportunities to tackle complex problems?", score: 8, kind: "strength" as const },
      { id: "q3", text: "Are you learning new skills in your current role?",      score: 7, kind: "strength" as const },
      { id: "q4", text: "Does your manager invest in your development?",          score: 4, kind: "concern" as const },
      { id: "q5", text: "Do you have a clear path to grow in this company?",      score: 3, kind: "concern" as const },
    ],
  };
}

/**
 * Aggregated team view for a manager. Enforces the anonymisation floor:
 * nothing is returned unless there are >= ANONYMISATION_FLOOR reportees and
 * responses. Returns only aggregates — never an individual-identifying field.
 */
export async function getTeamAggregate(
  session: SessionUser,
  teamId: string,
  window: Window = "3M"
): Promise<TeamAggregate> {
  assertRole(session, "manager", "reviewing_manager", "ceo_hr");

  // Sample: this team has 6 reportees with responses above the floor.
  const reporteeCount = 6;
  const responseCount = 41;

  const empty: TeamAggregate = {
    enoughData: false,
    reason: `Need at least ${ANONYMISATION_FLOOR} reportees with responses to show team data.`,
    teamScore: null,
    delta: null,
    participation: 0,
    reporteeCount,
    pillars: [],
    trend: [],
  };

  if (reporteeCount < ANONYMISATION_FLOOR) return empty;
  if (enforceAnonymisationFloor(true, responseCount) === null) return empty;

  const points = Math.min(weeksIn(window), RECENT_WEEKS.length);
  const trend = buildTrend("team-" + teamId, 6.7, points);
  const teamScore = trend[trend.length - 1].overall;
  const prior = trend.length > 1 ? trend[trend.length - 2].overall : null;

  return {
    enoughData: true,
    teamScore,
    delta: prior === null ? null : round1(teamScore - prior),
    participation: 78,
    reporteeCount,
    pillars: pillarScoresFrom(trend),
    trend,
  };
}

/** A sample recommendation for a low-scoring pillar (RecommendationCard). */
export function getSampleRecommendation(pillarId: PillarId): { pillarId: PillarId; text: string } {
  const text: Record<PillarId, string> = {
    meaningful_work: "Try linking one task this week to a goal you personally care about, and note how it felt.",
    growth: "Ask your manager for one stretch task this sprint — something just beyond your current comfort zone.",
    culture: "Recognise a teammate's good work openly this week; small recognition compounds team trust.",
    compensation: "Document your recent wins so you have concrete examples ready for your next comp conversation.",
  };
  return { pillarId, text: text[pillarId] };
}

/** Re-export so screens can build ScoreResult-shaped deltas without a second import. */
export { trendDelta, type ScoreResult };
