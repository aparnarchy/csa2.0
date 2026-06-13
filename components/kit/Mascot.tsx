import Image from "next/image";
import type { MascotState } from "@/lib/mascot";

// A few sparkles that drift/twinkle around the mascot. Decorative only.
const SPARKLES: { pos: React.CSSProperties; size: number; delay: string }[] = [
  { pos: { top: "-2%", left: "-8%" }, size: 12, delay: "0s" },
  { pos: { top: "14%", right: "-9%" }, size: 8, delay: "0.6s" },
  { pos: { bottom: "4%", left: "-3%" }, size: 9, delay: "1.1s" },
];

/**
 * The owner's mascot character, picked by `state`, gently floating with a few
 * twinkling sparkles around it. Each pose is a free-floating cut-out on a
 * uniform square canvas, so sizing/placement stays consistent across poses.
 */
export function Mascot({
  state,
  size = 80,
  sparkle = true,
}: {
  state: MascotState;
  size?: number;
  sparkle?: boolean;
}) {
  const src = `/mascot/${state}.png`;

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
      <div className="mascot-float relative h-full w-full">
        <Image
          src={src}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-contain"
          priority
          unoptimized
        />
      </div>
    </div>
  );
}
