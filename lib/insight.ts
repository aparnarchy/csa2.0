/**
 * Deterministic, human-sounding dashboard copy built from the numbers we already
 * compute — so the screen reads "insight-first" and scannable today. In Phase 5
 * the AI slot can replace this copy with richer LLM prose; the shape stays.
 */
import { getSampleRecommendation, type EmployeeScores } from "./data";
import { PILLARS } from "./pillars";
import type { Persona, PillarId } from "./types";
import { voicedHeadline, voicedRca, type Trend } from "./voice";

export interface EmployeeInsight {
  headline: string; // short, punchy hero phrase
  emoji: string;
  brightSpot: { label: string; score: number; pillarId: PillarId } | null;
  watchOut: { label: string; score: number; pillarId: PillarId } | null;
  comparison: string | null; // e.g. "Happier than 91% of your org"
  action: string | null; // one thing to try (lowest pillar)
}

export function buildEmployeeInsight(data: EmployeeScores, persona?: Persona): EmployeeInsight {
  if (!data.enoughData || data.overall === null) {
    return {
      headline: "Let's get to know you",
      emoji: "👋",
      brightSpot: null,
      watchOut: null,
      comparison: "Answer a few check-ins to unlock your insights",
      action: null,
    };
  }

  const scored = data.pillars.filter((p) => p.score !== null);
  const sorted = [...scored].sort((a, b) => (b.score as number) - (a.score as number));
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  const delta = data.delta;
  let trend: Trend;
  let emoji: string;
  if (delta !== null && delta >= 0.2) {
    trend = "up";
    emoji = "💜";
  } else if (delta !== null && delta <= -0.2) {
    trend = "down";
    emoji = "💪";
  } else {
    trend = "steady";
    emoji = "🙂";
  }
  const NEUTRAL_HEADLINE: Record<Trend, string> = {
    up: "Things are looking up",
    down: "A little dip this month",
    steady: "You're holding steady",
  };
  const headline = persona ? voicedHeadline(persona, trend) : NEUTRAL_HEADLINE[trend];

  const pct = data.percentiles?.org ?? data.percentile;

  return {
    headline,
    emoji,
    brightSpot: top
      ? { label: PILLARS[top.pillarId].label, score: top.score as number, pillarId: top.pillarId }
      : null,
    watchOut:
      bottom && bottom.pillarId !== top?.pillarId
        ? { label: PILLARS[bottom.pillarId].label, score: bottom.score as number, pillarId: bottom.pillarId }
        : null,
    comparison: pct ? `Happier than ${pct}% of your org` : null,
    action:
      bottom && (bottom.score as number) < 7
        ? persona
          ? voicedRca(persona, bottom.pillarId).actions[0]
          : getSampleRecommendation(bottom.pillarId).text
        : null,
  };
}
