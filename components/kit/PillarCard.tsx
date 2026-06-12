import { PILLARS } from "@/lib/pillars";
import { scoreColor } from "@/lib/score-color";
import type { PillarScore } from "@/lib/data";

/**
 * A pillar tile for the 2×2 grid — soft colour-banded chip.
 * Colour band is LOCKED (>=7 green / 4–6 amber / <=3 red).
 * Below the floor (`score === null`) it shows "not enough data", not a 0.
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
        <p className="text-[10px] text-ink-3">{meta.label}</p>
        <p className="mt-2 text-xs text-ink-4">Not enough data</p>
      </button>
    );
  }

  const c = scoreColor(data.score);
  const up = (data.delta ?? 0) >= 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col rounded-2xl p-3 text-left transition active:scale-[0.98]"
      style={{ background: c.bg }}
    >
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[10px] text-ink-3">{meta.label}</p>
        {data.delta !== null && (
          <span className="text-[11px] font-semibold" style={{ color: c.text }}>
            {up ? "↑" : "↓"} {Math.abs(data.delta).toFixed(1)}
          </span>
        )}
      </div>
      <p className="font-display text-xl font-extrabold leading-none" style={{ color: c.text }}>
        {data.score.toFixed(1)}
      </p>
      {data.percentile !== null && (
        <p className="mt-1 text-[10px] opacity-75" style={{ color: c.text }}>
          {data.percentile}th percentile
        </p>
      )}
    </button>
  );
}
