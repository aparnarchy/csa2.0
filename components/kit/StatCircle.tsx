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
          {/* pillar, curved along the bottom */}
          <svg viewBox="0 0 100 22" className="mt-1.5 w-[84%]" aria-hidden>
            <defs>
              <path id={`${arcId}-b`} d="M 8 4 Q 50 22 92 4" fill="none" />
            </defs>
            <text fill="#ffffff" fillOpacity="0.85" fontSize="8" fontWeight="800" letterSpacing="0.8">
              <textPath href={`#${arcId}-b`} startOffset="50%" textAnchor="middle">
                {pillar}
              </textPath>
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}
