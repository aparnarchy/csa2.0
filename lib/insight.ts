/**
 * Deterministic, human-sounding dashboard copy built from the numbers we already
 * compute — so the screen reads "insight-first" today. In Phase 5 the AI slot can
 * replace `headline`/`action` with richer LLM prose; the shape stays the same.
 */
import { getSampleRecommendation, type EmployeeScores } from "./data";
import { PILLARS } from "./pillars";

export interface EmployeeInsight {
  bubble: string; // short line for the mascot's speech bubble
  headline: string; // the narrative summary
  action: string | null; // one suggested thing to try (lowest pillar)
}

export function buildEmployeeInsight(data: EmployeeScores, fullName: string): EmployeeInsight {
  const first = (fullName || "there").trim().split(/\s+/)[0];

  if (!data.enoughData || data.overall === null) {
    return {
      bubble: "Hi there!",
      headline: `A few more check-ins, ${first}, and I'll start spotting patterns in how you're feeling.`,
      action: null,
    };
  }

  const overall = data.overall;
  const scored = data.pillars.filter(
    (p): p is typeof p & { score: number } => p.score !== null,
  );
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  const delta = data.delta;
  let lead: string;
  if (delta !== null && delta >= 0.2) {
    lead = `You're up ${delta.toFixed(1)} since last check-in, ${first} — nice momentum.`;
  } else if (delta !== null && delta <= -0.2) {
    lead = `You've dipped ${Math.abs(delta).toFixed(1)} since last check-in, ${first}.`;
  } else {
    lead = `You're holding steady this month, ${first}.`;
  }

  let spot = "";
  if (top && bottom && top.pillarId !== bottom.pillarId) {
    spot = ` ${PILLARS[top.pillarId].label} (${top.score.toFixed(1)}) is your bright spot, while ${PILLARS[bottom.pillarId].label} (${bottom.score.toFixed(1)}) could use some love.`;
  }

  const pct = data.percentiles?.org ?? data.percentile;
  const compare = pct ? ` You're happier than ${pct}% of the org.` : "";

  const headline = `${lead}${spot}${compare}`;
  const action = bottom && bottom.score < 7 ? getSampleRecommendation(bottom.pillarId).text : null;

  const bubble =
    overall >= 8 ? "Feeling great!" :
    overall >= 7 ? "Good vibes!" :
    overall >= 5 ? "Hanging in there" :
    "Let's turn this around";

  return { bubble, headline, action };
}
