import { ICON_PATHS } from "./Icons";

/**
 * A wavy, gently morphing "blob" score circle — Bright Spot / Watch Out. Two
 * softer blobs float + morph behind it. Both labels curve (title along the
 * top, pillar along the bottom). The `.sc-content` group is scaled by the
 * parent (ScoreCircles) so the text grows/shrinks proportionally with the circle.
 *
 * `score` null = an empty slot (no area earns it): no number, no pillar and no
 * warning icon — just `emptyText` in the middle.
 */
export function StatCircle({
  kind,
  label,
  score,
  pillar,
  emptyText,
}: {
  kind: "bright" | "watch";
  label: string;
  score: number | null;
  pillar: string;
  emptyText?: string;
}) {
  // White on colour. Bright spot is purple; Watch out blends purple into a
  // soft pink with a touch of peach (owner, 2026-10-15) so the two read as a
  // pair but are told apart at a glance. A small line icon (sparkles / eye)
  // sits above each curved title.
  const empty = score === null;
  const watch = kind === "watch";
  const front = watch
    ? "linear-gradient(155deg, #A68AF0 0%, #E58FA9 62%, #F0A495 100%)"
    : "linear-gradient(155deg, #8E7FFF 0%, #6A5CEB 100%)";
  const haloOuter = watch ? "bg-[#F8E2E8]" : "bg-[#D9D1FF]";
  const haloInner = watch ? "bg-[#F3CFD9]" : "bg-[#C6BAFF]";
  const titleColor = "#FFFFFF";
  const arcId = `arc-${kind}`;

  // The pillar sits on a fixed-length arc — roughly 91 units of this 100-wide
  // viewBox. A textPath neither wraps nor scales: anything longer than the path
  // is simply not drawn. Long labels step down a size to stay well inside that
  // length, and textLength is the backstop whatever the font metrics turn out
  // to be. (The longest real pillar, "Meaningful Work", measures ~81 here, so
  // it clears the arc comfortably — what used to shear its "M" and "k" was the
  // arc's height, not its length. See the note on the arc itself below.)
  const ARC_LEN = 88; // usable length, leaving a small margin at each end
  const pillarSize = pillar.length > 12 ? 8.6 : pillar.length > 9 ? 9.6 : 10.5;
  const tooLong = pillar.length * (pillarSize * 0.58 + 0.5) > ARC_LEN;

  return (
    <div className="relative aspect-square w-full">
      {/* two floating blobs behind, each morphing + drifting on its own rhythm */}
      <div className={`blob-back absolute -inset-2 ${haloOuter}`} aria-hidden />
      <div className={`blob-back2 absolute -inset-1 ${haloInner}`} aria-hidden />
      {/* foreground wavy blob — content sits a little high (top half) */}
      <div
        className="blob-front relative flex h-full items-center justify-center px-2 pb-[15%] text-center text-white shadow-card"
        // One shade deeper than the lavender around it so the white numbers
        // and curved labels stay readable on a phone in daylight.
        style={{
          background: front,
          boxShadow: watch ? "0 10px 24px -12px rgba(210,110,140,0.55)" : undefined,
        }}
      >
        <div className="sc-content flex w-full flex-col items-center will-change-transform">
          {/* title, curved along the top */}
          <svg viewBox="0 0 100 32" className="w-[94%]" aria-hidden>
            <defs>
              <path id={arcId} d="M 5 29 Q 50 4 95 29" fill="none" />
            </defs>
            {/* icon just above the top of the curve */}
            <g
              transform="translate(45.5 0) scale(0.375)"
              fill="none"
              stroke={titleColor}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {watch ? ICON_PATHS.eye : ICON_PATHS.sparkles}
            </g>
            <text fill={titleColor} fontSize="9" fontWeight="800" letterSpacing="0.2">
              <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
                {label}
              </textPath>
            </text>
          </svg>
          {empty ? (
            <p className="mt-1 px-3 text-[13px] font-bold leading-snug text-white/90">{emptyText}</p>
          ) : (
            <p className="-mt-1 font-display text-[46px] font-black leading-none">{score.toFixed(1)}</p>
          )}
          {/* pillar, curved along the bottom. The arc sits low in its box on
              purpose: its ends are its highest points, and a long label reaches
              out towards them, where the letters are also tilted. With the ends
              near the top of the viewBox the tops of "M" and "k" in "Meaningful
              Work" rose above y=0 and were sliced off by the SVG viewport. The
              curve is unchanged — just moved down into the empty space that was
              sitting below it, which leaves every label clear of both edges. */}
          <svg viewBox="0 0 100 24" className="mt-1.5 w-[94%]" aria-hidden>
            <defs>
              <path id={`${arcId}-b`} d="M 6 9 Q 50 29 94 9" fill="none" />
            </defs>
            <text fill="#ffffff" fillOpacity="0.9" fontSize={pillarSize} fontWeight="800" letterSpacing="0.5">
              <textPath
                href={`#${arcId}-b`}
                startOffset="50%"
                textAnchor="middle"
                {...(tooLong ? { textLength: ARC_LEN, lengthAdjust: "spacingAndGlyphs" as const } : {})}
              >
                {pillar}
              </textPath>
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}
