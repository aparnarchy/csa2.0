import type { ReactNode } from "react";
import { scoreTagline } from "@/lib/mood";
import { CountUp } from "./CountUp";

/**
 * The large animated overall score numeral. `score === null` means no data yet:
 * it shows 0.0 in grey with the "no check-ins yet" line (never a red score or
 * an encouraging/discouraging tagline that data doesn't back up). The tagline
 * comes from lib/mood.ts so it always matches the number's level.
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
  inline = false,
}: {
  score: number | null;
  caption?: string;
  trailing?: ReactNode;
  /** Slim layout: `trailing` and the tagline stack beside the numeral
   *  instead of the tagline sitting underneath (employee dashboard). */
  inline?: boolean;
}) {
  if (inline && score !== null) {
    return (
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-brand">{caption ?? "Overall Happiness"}</p>
        <div className="mt-1.5 flex items-center gap-3.5">
          <span className="block font-display text-[60px] font-black leading-[0.85] tracking-tight text-[#8B82F6]">
            <CountUp target={score} />
          </span>
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            {trailing}
            <p className="text-xs font-semibold text-ink-2">{scoreTagline(score)}</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-brand">
        {caption ?? "Overall Happiness"}
      </p>
      <div className="mt-1 flex items-end gap-2.5">
        {score === null ? (
          <span className="block font-display text-[68px] font-black leading-[0.85] tracking-tight text-ink-4/50">
            0.0
          </span>
        ) : (
          <span className="block font-display text-[68px] font-black leading-[0.85] tracking-tight text-[#8B82F6]">
            <CountUp target={score} />
          </span>
        )}
        {trailing && <div className="mb-1">{trailing}</div>}
      </div>
      <p className={`mt-2 text-xs font-semibold ${score === null ? "text-ink-4" : "text-ink-2"}`}>
        {scoreTagline(score)}
      </p>
    </div>
  );
}
