/**
 * Pure scoring/calculation helpers. No database access, no React.
 * These are deterministic functions so they can be spot-checked against seed data.
 *
 * Key rule: below the anonymisation/confidence floor we return a clear
 * "not enough data" signal (value === null) — never a misleading 0.
 */

import type { PillarId } from "./types";

/** Minimum responses before a score is shown (also the anonymisation floor). */
export const ANONYMISATION_FLOOR = 3;

/** The minimal shape scoring needs from a check-in row. */
export interface ScoredCheckIn {
  score: number;
  pillarId: PillarId;
  weekId: string;
  isRetrospective: boolean;
}

export interface ScoreResult {
  /** The averaged score (0–10), rounded to 1 decimal — or null if below the floor. */
  value: number | null;
  /** How many responses fed this score. */
  responseCount: number;
  /** True when responseCount >= ANONYMISATION_FLOOR. */
  enoughData: boolean;
}

const notEnough = (count: number): ScoreResult => ({
  value: null,
  responseCount: count,
  enoughData: false,
});

function average(nums: number[]): number {
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round((sum / nums.length) * 10) / 10;
}

/** True once there are at least ANONYMISATION_FLOOR responses. */
export function hasEnoughData(responseCount: number): boolean {
  return responseCount >= ANONYMISATION_FLOOR;
}

/** Colour band for a score: >=7 green, 4–6 amber, <=3 red. */
export function scoreBand(score: number): "green" | "amber" | "red" {
  if (score >= 7) return "green";
  if (score >= 4) return "amber";
  return "red";
}

/** Overall score = average of all responses in the window. */
export function overallScore(checkIns: ScoredCheckIn[]): ScoreResult {
  const count = checkIns.length;
  if (!hasEnoughData(count)) return notEnough(count);
  return { value: average(checkIns.map((c) => c.score)), responseCount: count, enoughData: true };
}

/** Pillar score = average of responses for one pillar in the window. */
export function pillarScore(checkIns: ScoredCheckIn[], pillarId: PillarId): ScoreResult {
  const rows = checkIns.filter((c) => c.pillarId === pillarId);
  const count = rows.length;
  if (!hasEnoughData(count)) return notEnough(count);
  return { value: average(rows.map((c) => c.score)), responseCount: count, enoughData: true };
}

/**
 * Trend delta = current score minus prior-window score, rounded to 1 decimal.
 * Returns null when either window lacks enough data (so the UI hides the delta).
 */
export function trendDelta(current: ScoreResult, prior: ScoreResult): number | null {
  if (current.value === null || prior.value === null) return null;
  return Math.round((current.value - prior.value) * 10) / 10;
}

/**
 * Percentile of `value` within `population` (0–100): the percentage of the
 * population scoring strictly below `value`. Returns null for an empty population.
 */
export function percentile(value: number, population: number[]): number | null {
  if (population.length === 0) return null;
  const below = population.filter((p) => p < value).length;
  return Math.round((below / population.length) * 100);
}

/** Convert "YYYY-Www" into a comparable integer so weeks can be ordered/diffed. */
function weekIndex(weekId: string): number {
  const m = weekId.match(/^(\d{4})-W(\d{1,2})$/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 53 + parseInt(m[2], 10);
}

/**
 * Streak = number of consecutive weeks (ending at the most recent answered week)
 * with at least one NON-retrospective response. Retrospective answers are excluded.
 */
export function computeStreak(checkIns: ScoredCheckIn[]): number {
  const weeks = [
    ...new Set(checkIns.filter((c) => !c.isRetrospective).map((c) => c.weekId)),
  ]
    .map(weekIndex)
    .sort((a, b) => b - a);

  if (weeks.length === 0) return 0;

  let streak = 1;
  for (let i = 1; i < weeks.length; i++) {
    if (weeks[i] === weeks[i - 1] - 1) streak++;
    else break;
  }
  return streak;
}
