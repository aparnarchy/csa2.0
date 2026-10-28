/**
 * A small, calm "nothing waiting" animation: three soft waves in the app's
 * lavenders rolling at different speeds, with a little paper boat bobbing on
 * top (owner, 2026-10-28: something generic in the app's theme, not the
 * mascot). Pure SVG + CSS (globals.css .calm-*), no library. Stays still for
 * people who turn off motion on their phone.
 */
// Eight half-waves across 200 units: the left half repeats exactly in the
// right half, so sliding by 50% loops with no jump.
const WAVE = `M0 20 Q 12.5 10 25 20 ${[50, 75, 100, 125, 150, 175, 200].map((x) => `T ${x} 20`).join(" ")} V 40 H 0 Z`;

export function CalmWaves({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`relative h-20 overflow-hidden rounded-2xl bg-lav-light ${className}`}>
      <svg className="calm-boat absolute left-1/2 top-[27px] -ml-4 h-8 w-8" viewBox="0 0 32 32">
        <path d="M16 3 V20 M16 4 L26 18 H16 Z" fill="#c4bcff" stroke="#7c6fff" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M5 21 H27 L23 27 H9 Z" fill="#7c6fff" />
      </svg>
      {[
        { cls: "calm-wave-1", fill: "#e1d7ff", top: 38 },
        { cls: "calm-wave-2", fill: "#c9b4ff", top: 46 },
        { cls: "calm-wave-3", fill: "#9b8fff", top: 56 },
      ].map((w) => (
        <svg
          key={w.cls}
          className={`${w.cls} absolute left-0 h-10 w-[200%]`}
          style={{ top: w.top }}
          viewBox="0 0 200 40"
          preserveAspectRatio="none"
        >
          <path d={WAVE} fill={w.fill} />
        </svg>
      ))}
    </div>
  );
}
