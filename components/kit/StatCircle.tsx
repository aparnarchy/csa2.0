/**
 * A big rounded stat "circle" for the dashboard top — Bright Spot / Watch Out.
 * A softer lighter blob sits behind it and gently drifts (one calm animation
 * layer). Both share the brand purple; only the icon/label differ.
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
  const icon = kind === "bright" ? "☀️" : "❗";
  const drift = kind === "bright" ? "drift-a" : "drift-b";

  return (
    <div className="relative aspect-square">
      {/* lighter blob behind, gently drifting */}
      <div className={`${drift} absolute inset-0 rounded-[40px] bg-[#CBC0FF]`} aria-hidden />
      {/* foreground circle */}
      <div
        className="relative flex h-full flex-col items-center justify-center rounded-[40px] p-4 text-center text-white shadow-card"
        style={{ background: "linear-gradient(155deg, #9C8DFF 0%, #786AF4 100%)" }}
      >
        <p className="flex items-center gap-1 text-[12px] font-bold text-white/85">
          <span aria-hidden>{icon}</span> {label}
        </p>
        <p className="mt-1 font-display text-[44px] font-black leading-none">{score.toFixed(1)}</p>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-white/80">{pillar}</p>
      </div>
    </div>
  );
}
