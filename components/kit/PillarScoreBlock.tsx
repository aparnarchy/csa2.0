import { COPY } from "@/lib/copy";
import { scoreTagline } from "@/lib/mood";

/**
 * The score shown in a pillar-detail header (employee, team and CEO pillar
 * pages all use this). No score yet → 0.0 in grey with "no answers yet",
 * never a red 0. The tagline and colour follow lib/mood.ts, same as every
 * other score in the app.
 */
export function PillarScoreBlock({ score, delta }: { score: number | null; delta: number | null }) {
  if (score === null) {
    return (
      <div className="mt-3">
        <span className="font-display text-[56px] font-black leading-none text-ink-4/50">0.0</span>
        <p className="mt-1 text-xs text-ink-3">{COPY.mood.noDataPillar}</p>
      </div>
    );
  }
  const up = (delta ?? 0) >= 0;
  return (
    <div className="mt-3">
      <div className="flex items-end gap-3.5">
        <span className="font-display text-[56px] font-black leading-none text-[#8B82F6]">{score.toFixed(1)}</span>
        {delta !== null && (
          <div className="pb-2.5 text-sm font-bold text-ink-2">
            {up ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}
          </div>
        )}
      </div>
      <p className="mt-1 text-xs font-semibold text-ink-2">{scoreTagline(score)}</p>
    </div>
  );
}

/** The empty line under a pillar's Strengths / Concerns toggle — says "no
 *  answers yet" when there are none, rather than implying all is well. */
export function emptyInsightLine(hasAnyQuestions: boolean, tab: "strengths" | "concerns"): string {
  if (!hasAnyQuestions) return COPY.mood.noDataPillar;
  return tab === "strengths" ? "Nothing scoring 7+ yet." : "Nothing scoring below 7 — nice.";
}
