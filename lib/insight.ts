/**
 * Deterministic, human-sounding dashboard copy built from the numbers we already
 * compute — so the screen reads "insight-first" and scannable today. In Phase 5
 * the AI slot can replace this copy with richer LLM prose; the shape stays.
 */
import { getSampleRecommendation, type EmployeeScores } from "./data";
import { PILLARS } from "./pillars";

export interface EmployeeInsight {
  headline: string; // short, punchy hero phrase
  emoji: string;
  brightSpot: { label: string; score: number } | null;
  watchOut: { label: string; score: number } | null;
  comparison: string | null; // e.g. "Happier than 91% of your org"
  action: string | null; // one thing to try (lowest pillar)
}

export function buildEmployeeInsight(data: EmployeeScores): EmployeeInsight {
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
  let headline: string;
  let emoji: string;
  if (delta !== null && delta >= 0.2) {
    headline = "Things are looking up";
    emoji = "💜";
  } else if (delta !== null && delta <= -0.2) {
    headline = "A little dip this month";
    emoji = "💪";
  } else {
    headline = "You're holding steady";
    emoji = "🙂";
  }

  const pct = data.percentiles?.org ?? data.percentile;

  return {
    headline,
    emoji,
    brightSpot: top ? { label: PILLARS[top.pillarId].label, score: top.score as number } : null,
    watchOut:
      bottom && bottom.pillarId !== top?.pillarId
        ? { label: PILLARS[bottom.pillarId].label, score: bottom.score as number }
        : null,
    comparison: pct ? `Happier than ${pct}% of your org` : null,
    action: bottom && (bottom.score as number) < 7 ? getSampleRecommendation(bottom.pillarId).text : null,
  };
}
