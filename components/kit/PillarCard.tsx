import { PILLARS } from "@/lib/pillars";
import type { PillarScore } from "@/lib/data";

/**
 * A pillar tile for the 2×2 grid — uniform pastel-lavender chip with purple text
 * (the score colour bands are intentionally not applied here, per the owner's
 * design direction). Below the floor (`score === null`) it shows "not enough
 * data", not a 0.
 */
export function PillarCard({
  data,
  onClick,
}: {
  data: PillarScore;
  onClick?: () => void;
}) {
  const meta = PILLARS[data.pillarId];

  if (data.score === null) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-col rounded-2xl bg-lav-soft p-3 text-left"
      >
        <p className="text-[10px] text-brand/70">{meta.label}</p>
        <p className="mt-2 text-xs text-ink-4">Not enough data</p>
      </button>
    );
  }

  const up = (data.delta ?? 0) >= 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col rounded-2xl bg-lav-soft p-3 text-left transition active:scale-[0.98]"
    >
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[10px] text-brand/70">{meta.label}</p>
        {data.delta !== null && (
          <span className="text-[11px] font-semibold text-brand">
            {up ? "↑" : "↓"} {Math.abs(data.delta).toFixed(1)}
          </span>
        )}
      </div>
      <p className="font-display text-xl font-extrabold leading-none text-brand">
        {data.score.toFixed(1)}
      </p>
      {data.percentile !== null && (
        <p className="mt-1 text-[10px] text-brand/70">{data.percentile}th percentile</p>
      )}
    </button>
  );
}
