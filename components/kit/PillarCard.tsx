import { PILLARS } from "@/lib/pillars";
import type { PillarScore } from "@/lib/data";

/** 1 → "1st", 2 → "2nd", 21 → "21st", 11 → "11th". */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/**
 * A pillar tile for the single-row 4-across grid — uniform pastel-lavender chip
 * with purple text (the score colour bands are intentionally not applied here,
 * per the owner's design direction). Below the floor (`score === null`) it shows
 * "not enough data", not a 0.
 *
 * Mobile-only: at 375px the row leaves ~72px per tile, so type is small, content
 * is centred, and both the label and "47th percentile" wrap to two lines. The
 * label's two lines are reserved on every tile (`min-h`) with the text centred
 * inside that box, so one-word pillars stay level with "Meaningful Work" and all
 * four scores share a baseline.
 */
export function PillarCard({
  data,
  onClick,
}: {
  data: PillarScore;
  onClick?: () => void;
}) {
  const meta = PILLARS[data.pillarId];

  const label = (
    <p className="mt-2 flex min-h-[22px] items-center justify-center text-center text-[9px] font-bold uppercase leading-[1.2] tracking-tight text-brand/75">
      {meta.label}
    </p>
  );

  if (data.score === null) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-col items-center rounded-2xl bg-lav-soft px-2 pb-2.5 pt-2.5"
      >
        <p className="font-display text-[21px] font-extrabold leading-none text-brand/30">—</p>
        {label}
        <p className="mt-0.5 text-center text-[8px] leading-[1.25] text-ink-4">
          Not enough data
        </p>
      </button>
    );
  }

  const up = (data.delta ?? 0) >= 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-center rounded-2xl bg-lav-soft px-2 pb-2.5 pt-2.5 transition active:scale-[0.98]"
    >
      {/* The score is the centred element, not the score+delta pair — a centred
          pair would push the number off-centre by half the delta's width. The
          delta is zero-width so it hangs off to the right without shifting the
          number, overflowing into the tile's right padding. */}
      <div className="flex w-full items-baseline justify-center">
        <p className="font-display text-[21px] font-extrabold leading-none text-brand">
          {data.score.toFixed(1)}
        </p>
        {data.delta !== null && (
          <span className="w-0 whitespace-nowrap pl-[3px] text-[8px] font-bold leading-none text-brand/50">
            {up ? "↑" : "↓"}
            {Math.abs(data.delta).toFixed(1)}
          </span>
        )}
      </div>
      {label}
      {/* Least important datum — smallest type, lowest contrast. */}
      {data.percentile !== null && (
        <p className="mt-0.5 text-center text-[8px] leading-[1.25] text-brand/45">
          {ordinal(data.percentile)} percentile
        </p>
      )}
    </button>
  );
}
