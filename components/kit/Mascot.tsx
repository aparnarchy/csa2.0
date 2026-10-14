import type { MascotState } from "@/lib/mascot";
import { MascotArt } from "./AnswerMascot";

// A few sparkles that drift/twinkle around the mascot. Decorative only.
const SPARKLES: { pos: React.CSSProperties; size: number; delay: string }[] = [
  { pos: { top: "-2%", left: "-8%" }, size: 12, delay: "0s" },
  { pos: { top: "14%", right: "-9%" }, size: 8, delay: "0.6s" },
  { pos: { bottom: "4%", left: "-3%" }, size: 9, delay: "1.1s" },
];

/**
 * The CSA mascot (an original character drawn in code — components/kit/
 * AnswerMascot.tsx), posed by `state`, gently floating with a few twinkling
 * sparkles around it. Always drawn inside a `size` square, so sizing and
 * placement stay consistent across poses.
 */
export function Mascot({
  state,
  size = 80,
  sparkle = true,
  float = true,
}: {
  state: MascotState;
  size?: number;
  sparkle?: boolean;
  /** Gentle up/down bob. Set false for a still character. */
  float?: boolean;
}) {
  return (
    <div className="relative" style={{ width: size, height: size }} aria-hidden>
      {sparkle &&
        SPARKLES.map((s, i) => (
          <span
            key={i}
            className="twinkle pointer-events-none absolute z-10 leading-none text-white/90"
            style={{ ...s.pos, fontSize: s.size, animationDelay: s.delay }}
          >
            ✦
          </span>
        ))}
      <div className={`relative h-full w-full ${float ? "mascot-float" : ""}`}>
        <MascotArt mood={state} />
      </div>
    </div>
  );
}
