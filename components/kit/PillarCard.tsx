import { PILLARS } from "@/lib/pillars";
import type { PillarScore } from "@/lib/data";

/**
 * A pillar tile for the single-row 4-across grid — uniform pastel-lavender chip
 * with purple text (the score colour bands are intentionally not applied here,
 * per the owner's design direction). Below the floor (`score === null`) it shows
 * "no data", not a 0.
 *
 * Sizing note: at 375px the row leaves ~71px per tile, so the label is 8px
 * uppercase and wraps to two lines. Those two lines are reserved on every tile
 * (`min-h`) so single-word pillars stay the same height as "Meaningful Work"
 * and all four scores sit on one baseline.
 */
/** 1 → "1st", 2 → "2nd", 21 → "21st", 11 → "11th". */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

export function PillarCard({
  data,
  onClick,
}: {
  data: PillarScore;
  onClick?: () => void;
}) {
  const meta = PILLARS[data.pillarId];

  const label = (
    <p className="flex min-h-[20px] items-start justify-center text-center text-[8px] font-bold uppercase leading-[1.25] tracking-tight text-brand/70">
      {meta.label}
    </p>
  );

  if (data.score === null) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-col items-center rounded-2xl bg-lav-soft p-2"
      >
        <p className="font-display text-lg font-extrabold leading-none text-brand/30">—</p>
        {label}
        <p className="text-[8px] leading-tight text-ink-4">no data</p>
      </button>
    );
  }

  const up = (data.delta ?? 0) >= 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-center rounded-2xl bg-lav-soft p-2 transition active:scale-[0.98]"
    >
      {/* Score leads; the delta rides its baseline so both fit one line. */}
      <div className="flex items-baseline justify-center gap-0.5">
        <p className="font-display text-lg font-extrabold leading-none text-brand">
          {data.score.toFixed(1)}
        </p>
        {data.delta !== null && (
          <span className="text-[9px] font-bold leading-none text-brand">
            {up ? "↑" : "↓"}
            {Math.abs(data.delta).toFixed(1)}
          </span>
        )}
      </div>
      {label}
      {/* "percentile" spelled out doesn't fit ~55px of content width. */}
      <p className="text-[8px] leading-tight text-brand/70">
        {data.percentile !== null ? `${ordinal(data.percentile)} pct` : " "}
      </p>
    </button>
  );
}
