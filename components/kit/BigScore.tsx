import { CountUp } from "./CountUp";

/**
 * The large animated overall score numeral. `score === null` is handled by the
 * caller (show NotEnoughData) — this component assumes a real number.
 */
export function BigScore({
  score,
  caption,
}: {
  score: number;
  caption?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-brand">
        {caption ?? "Overall Happiness"}
      </p>
      <span className="block font-display text-[68px] font-black leading-none tracking-tight text-[#8B82F6]">
        <CountUp target={score} />
      </span>
      <p className="mt-1.5 text-xs font-semibold text-ink-2">
        {score >= 7 ? "😊 YAY! Keep it up" : "🙁 Let’s work on this"}
      </p>
    </div>
  );
}
