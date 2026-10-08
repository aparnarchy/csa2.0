/**
 * Deterministic, human-sounding dashboard copy built from the numbers we already
 * compute — so the screen reads "insight-first" and scannable. Every word is
 * chosen from the score's own level (lib/mood.ts), so the copy can never
 * disagree with the number beside it.
 */
import { type PillarScore } from "./data";
import { PILLARS } from "./pillars";
import type { Persona, PillarId } from "./types";
import { COPY } from "./copy";
import { moodHeadline, scoreLevel } from "./mood";

export interface InsightSpot {
  /** The pillar's name, e.g. "Growth". */
  pillar: string;
  /** "Bright spot" or "Watch out" (from copy.html). */
  label: string;
  score: number;
  pillarId: PillarId;
}

export interface EmployeeInsight {
  headline: string; // short, punchy hero phrase
  /** Null = the slot shows its empty line (no score, no icon). */
  brightSpot: InsightSpot | null;
  watchOut: InsightSpot | null;
}

/**
 * Headline + highest/lowest pillar for any dashboard (employee, team, org).
 * Each spot is filled only when it's genuinely earned: Bright spot = the top
 * pillar, only if it scores above 7; Watch out = the lowest pillar, only if it
 * scores 7 or below. Otherwise that slot is null and the screen shows its
 * empty line ("Nothing to watch out for right now") — never a warning sign on
 * a good score.
 */
export function buildInsight(
  overall: number | null,
  delta: number | null,
  pillars: PillarScore[],
  persona?: Persona,
): EmployeeInsight {
  const headline = moodHeadline(overall, delta, persona);
  const scored = pillars.filter((p): p is PillarScore & { score: number } => p.score !== null);
  if (overall === null || scored.length === 0) return { headline, brightSpot: null, watchOut: null };

  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const good = (p: { score: number }) => scoreLevel(p.score) === "good";
  const spot = (p: PillarScore & { score: number }, label: string): InsightSpot => ({
    pillar: PILLARS[p.pillarId].label,
    label,
    score: p.score,
    pillarId: p.pillarId,
  });
  return {
    headline,
    brightSpot: good(top) ? spot(top, COPY.mood.brightSpot) : null,
    watchOut: !good(bottom) ? spot(bottom, COPY.mood.watchOut) : null,
  };
}

/** The employee dashboard's insight (own scores). */
export function buildEmployeeInsight(
  data: { enoughData: boolean; overall: number | null; delta: number | null; pillars: PillarScore[] },
  persona?: Persona,
): EmployeeInsight {
  return buildInsight(data.enoughData ? data.overall : null, data.delta, data.pillars, persona);
}
