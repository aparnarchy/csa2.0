import type { InsightSpot } from "@/lib/insight";
import type { PillarId } from "@/lib/types";

/** Professional-mode Bright spot / Watch out tile (the Play-mode version is
    the wavy circle in ScoreCircles). Shared by the employee and manager
    dashboards so they stay identical. */
export function SpotCard({
  title,
  spot,
  onSelect,
}: {
  title: string;
  spot: InsightSpot;
  onSelect: (pillarId: PillarId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(spot.pillarId)}
      className="rounded-card bg-lav-soft p-4 text-left shadow-card transition active:scale-[0.98]"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">{title}</p>
      <p className="mt-1 font-display text-3xl font-black leading-none text-brand">{spot.score.toFixed(1)}</p>
      <p className="mt-1 text-xs text-brand/70">{spot.pillar}</p>
    </button>
  );
}
