/**
 * A wavy, gently morphing "blob" score circle — Bright Spot / Watch Out. Two
 * softer blobs float + morph behind it (a calm, layered animation), and the
 * title curves along the top in a warm colour. Sizing/animation of the pair is
 * controlled by the parent (ScoreCircles); this just fills its wrapper.
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
      {/* foreground wavy blob */}
      <div
        className="blob-front relative flex h-full flex-col items-center justify-center px-2 text-center text-white shadow-card"
        style={{ background: "linear-gradient(155deg, #9C8DFF 0%, #786AF4 100%)" }}
      >
        <span className="text-base leading-none" aria-hidden>{icon}</span>
        {/* curved, coloured title */}
        <svg viewBox="0 0 100 28" className="mt-0.5 w-[92%]" aria-hidden>
          <defs>
            <path id={arcId} d="M 5 25 Q 50 11 95 25" fill="none" />
          </defs>
          <text fill={titleColor} fontSize="9" fontWeight="800" letterSpacing="0.2">
            <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
              {label}
            </textPath>
          </text>
        </svg>
        <p className="-mt-0.5 font-display text-[42px] font-black leading-none">{score.toFixed(1)}</p>
        <p className="mt-1 text-[11px] font-black uppercase tracking-wider text-white/85">{pillar}</p>
      </div>
    </div>
  );
}
