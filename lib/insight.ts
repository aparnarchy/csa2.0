/**
 * Deterministic, human-sounding dashboard copy built from the numbers we already
 * compute — so the screen reads "insight-first" and scannable. Every word is
 * chosen from the score's own level (lib/mood.ts), so the copy can never
 * disagree with the number beside it.
 */
import { type PillarScore } from "./data";
import { PILLARS } from "./pillars";
import type { Persona, PillarId } from "./types";
import { bottomLabel, moodHeadline, topLabel } from "./mood";

export interface InsightSpot {
  /** The pillar's name, e.g. "Growth". */
  pillar: string;
  /** "Bright spot" / "Strongest area" or "Watch out" / "Lowest area". */
  label: string;
  score: number;
  pillarId: PillarId;
}

export interface EmployeeInsight {
  headline: string; // short, punchy hero phrase
  brightSpot: InsightSpot | null;
  watchOut: InsightSpot | null;
}

/**
 * Headline + highest/lowest pillar for any dashboard (employee, team, org).
 * Both spots need at least two pillars with real scores — with one, "highest"
 * and "lowest" would be the same pillar.
 */
export function buildInsight(
  overall: number | null,
  delta: number | null,
  pillars: PillarScore[],
  persona?: Persona,
): EmployeeInsight {
  const headline = moodHeadline(overall, delta, persona);
  const scored = pillars.filter((p): p is PillarScore & { score: number } => p.score !== null);
  if (overall === null || scored.length < 2) return { headline, brightSpot: null, watchOut: null };

  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const spot = (p: PillarScore & { score: number }, label: string): InsightSpot => ({
    pillar: PILLARS[p.pillarId].label,
    label,
    score: p.score,
    pillarId: p.pillarId,
  });
  return {
    headline,
    brightSpot: spot(top, topLabel(top.score)),
    watchOut: bottom.pillarId !== top.pillarId ? spot(bottom, bottomLabel(bottom.score)) : null,
  };
}

/** The employee dashboard's insight (own scores). */
export function buildEmployeeInsight(
  data: { enoughData: boolean; overall: number | null; delta: number | null; pillars: PillarScore[] },
  persona?: Persona,
): EmployeeInsight {
  return buildInsight(data.enoughData ? data.overall : null, data.delta, data.pillars, persona);
}
