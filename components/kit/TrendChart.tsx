"use client";

import { useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PILLARS, PILLAR_ORDER } from "@/lib/pillars";
import type { PillarId } from "@/lib/types";
import type { TrendPoint, Window } from "@/lib/data";
import { WINDOWS } from "@/lib/data";

type Series = "overall" | PillarId;

const SERIES_META: Record<Series, { label: string; hex: string }> = {
  overall: { label: "Overall", hex: "#111827" },
  meaningful_work: { label: PILLARS.meaningful_work.label, hex: PILLARS.meaningful_work.hex },
  growth: { label: PILLARS.growth.label, hex: PILLARS.growth.hex },
  culture: { label: PILLARS.culture.label, hex: PILLARS.culture.hex },
  compensation: { label: PILLARS.compensation.label, hex: PILLARS.compensation.hex },
};

/**
 * Trend line chart with a time filter and a pillar filter, plus org/industry
 * reference lines. The TIME filter is controlled by the parent (so it can
 * refresh the score + pillars + chart together). The PILLAR filter only
 * changes which line this chart draws.
 */
export function TrendChart({
  data,
  window,
  onWindowChange,
}: {
  data: TrendPoint[];
  window?: Window;
  onWindowChange?: (w: Window) => void;
}) {
  const [series, setSeries] = useState<Series>("overall");
  const meta = SERIES_META[series];

  const orgAvg = data.length ? data[data.length - 1].orgAvg : 0;
  const industryAvg = data.length ? data[data.length - 1].industryAvg : 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      {/* Time filter */}
      {onWindowChange && (
        <div className="mb-3 flex gap-1.5">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onWindowChange(w)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                w === window ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      )}

      {/* Pillar filter */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["overall", ...PILLAR_ORDER] as Series[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeries(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              s === series ? "text-white" : "bg-gray-100 text-gray-500"
            }`}
            style={s === series ? { backgroundColor: SERIES_META[s].hex } : undefined}
          >
            {SERIES_META[s].label}
          </button>
        ))}
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }}
              formatter={(v) => [Number(v).toFixed(1), meta.label]}
            />
            <ReferenceLine y={orgAvg} stroke="#94A3B8" strokeDasharray="4 4" label={{ value: "Org", fontSize: 10, fill: "#94A3B8", position: "right" }} />
            <ReferenceLine y={industryAvg} stroke="#CBD5E1" strokeDasharray="2 4" label={{ value: "Industry", fontSize: 10, fill: "#CBD5E1", position: "right" }} />
            <Line
              type="monotone"
              dataKey={series}
              stroke={meta.hex}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
