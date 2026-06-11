import { PILLARS } from "@/lib/pillars";
import type { PillarScore } from "@/lib/data";

/** Colour bands: >=7 green, 4–6 amber, <=3 red. */
const BAND_STYLES = {
  green: { ring: "border-emerald-200", chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  amber: { ring: "border-amber-200",   chip: "bg-amber-100 text-amber-700",     dot: "bg-amber-500" },
  red:   { ring: "border-red-200",     chip: "bg-red-100 text-red-700",         dot: "bg-red-500" },
} as const;

function Delta({ delta }: { delta: number }) {
  const up = delta >= 0;
  return (
    <span className={`text-sm font-semibold ${up ? "text-emerald-600" : "text-red-600"}`}>
      {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
    </span>
  );
}

/**
 * A single pillar tile for the 2×2 grid. Tap to drill into the pillar detail.
 * Below the floor (`score === null`) it shows "not enough data", not a 0.
 */
export function PillarCard({
  data,
  onClick,
}: {
  data: PillarScore;
  onClick?: () => void;
}) {
  const meta = PILLARS[data.pillarId];
  const band = data.band ? BAND_STYLES[data.band] : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition active:scale-[0.98] ${
        band ? band.ring : "border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${band ? band.dot : "bg-gray-300"}`} />
        <span className="text-base font-medium text-gray-700">{meta.label}</span>
      </div>

      {data.score === null ? (
        <p className="mt-3 text-sm text-gray-400">Not enough data</p>
      ) : (
        <div className="mt-3 flex items-end justify-between">
          <span className="text-3xl font-bold text-gray-900">{data.score.toFixed(1)}</span>
          {data.delta !== null && <Delta delta={data.delta} />}
        </div>
      )}
    </button>
  );
}
