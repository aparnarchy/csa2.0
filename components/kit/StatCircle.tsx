/**
 * A wavy, gently morphing "blob" score circle — Bright Spot / Watch Out. Two
 * softer blobs float + morph behind it. Both labels curve (icon-led title along
 * the top, pillar along the bottom). The `.sc-content` group is scaled by the
 * parent (ScoreCircles) so the text grows/shrinks proportionally with the circle.
 */
export function StatCircle({
  kind,
  label,
  score,
  pillar,
}: {
  kind: "bright" | "watch";
  label: string;
  score: number;
  pillar: string;
}) {
  const titleColor = kind === "bright" ? "#FFD36B" : "#FF9E9E";
  const icon = kind === "bright" ? "☀️" : "❗";
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
      <div className="blob-back absolute -inset-2 bg-[#D9D1FF]" aria-hidden />
      <div className="blob-back2 absolute -inset-1 bg-[#C6BAFF]" aria-hidden />
      {/* foreground wavy blob — content sits a little high (top half) */}
      <div
        className="blob-front relative flex h-full items-center justify-center px-2 pb-[15%] text-center text-white shadow-card"
        style={{ background: "linear-gradient(155deg, #9C8DFF 0%, #786AF4 100%)" }}
      >
        <div className="sc-content flex w-full flex-col items-center will-change-transform">
          {/* icon-led title, curved along the top */}
          <svg viewBox="0 0 100 32" className="w-[94%]" aria-hidden>
            <defs>
              <path id={arcId} d="M 5 29 Q 50 4 95 29" fill="none" />
            </defs>
            <text fill={titleColor} fontSize="9" fontWeight="800" letterSpacing="0.2">
              <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
                {icon} {label}
              </textPath>
            </text>
          </svg>
          <p className="-mt-1 font-display text-[46px] font-black leading-none">{score.toFixed(1)}</p>
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
