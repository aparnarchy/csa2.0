import type { ReactNode } from "react";
import { CountUp } from "./CountUp";

/**
 * The large animated overall score numeral. `score === null` is handled by the
 * caller (show NotEnoughData) — this component assumes a real number.
 *
 * `trailing` renders beside the numeral, bottom-aligned to it — used for the
 * delta badge. Passing it here rather than letting the caller float the badge
 * in a `justify-between` row keeps the badge level with the number it
 * describes, instead of level with the eyebrow two lines above it.
 *
 * `leading-[0.85]` crops the display font's built-in shoulder above and below
 * the digits (safe — numerals have no descenders), which is what closes the
 * gap between the numeral and the supporting line beneath it.
 */
export function BigScore({
  score,
  caption,
  trailing,
}: {
  score: number;
  caption?: string;
  trailing?: ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-brand">
        {caption ?? "Overall Happiness"}
      </p>
      <div className="mt-1 flex items-end gap-2.5">
        <span className="block font-display text-[68px] font-black leading-[0.85] tracking-tight text-[#8B82F6]">
          <CountUp target={score} />
        </span>
        {trailing && <div className="mb-1">{trailing}</div>}
      </div>
      <p className="mt-2 text-xs font-semibold text-ink-2">
        {score >= 7 ? "😊 YAY! Keep it up" : "🙁 Let’s work on this"}
      </p>
    </div>
  );
}
