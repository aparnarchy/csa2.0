import { scoreBand } from "@/lib/scoring";
import { NotEnoughData } from "./NotEnoughData";

const BAND_COLOR = {
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
} as const;

function DeltaBadge({ delta }: { delta: number }) {
  const up = delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-sm font-semibold ${
        up ? "text-emerald-600" : "text-red-600"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
    </span>
  );
}

/**
 * Large circular score (0–10) with optional trend delta.
 * `delta === null` hides the delta (e.g. no prior window).
 * `score === null` renders the NotEnoughData state.
 */
export function ScoreRing({
  score,
  delta = null,
  label,
  size = 160,
}: {
  score: number | null;
  delta?: number | null;
  label?: string;
  size?: number;
}) {
  if (score === null) return <NotEnoughData />;

  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, score / 10));
  const color = BAND_COLOR[scoreBand(score)];

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="#E5E7EB" strokeWidth={stroke}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-gray-900">{score.toFixed(1)}</span>
          <span className="text-sm text-gray-400">/ 10</span>
        </div>
      </div>
      {(label || delta !== null) && (
        <div className="mt-2 flex items-center gap-2">
          {label && <span className="text-base font-medium text-gray-600">{label}</span>}
          {delta !== null && <DeltaBadge delta={delta} />}
        </div>
      )}
    </div>
  );
}
