"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PILLARS, PILLAR_ORDER } from "@/lib/pillars";
import type { PillarId } from "@/lib/types";
import type { TrendPoint, Window } from "@/lib/data";
import { CustomDropdown } from "./CustomDropdown";

type Series = "overall" | PillarId;

const SERIES_META: Record<Series, { label: string; hex: string }> = {
  overall: { label: "All Pillars", hex: "#7C6FFF" },
  meaningful_work: { label: PILLARS.meaningful_work.label, hex: PILLARS.meaningful_work.hex },
  growth: { label: PILLARS.growth.label, hex: PILLARS.growth.hex },
  culture: { label: PILLARS.culture.label, hex: PILLARS.culture.hex },
  compensation: { label: PILLARS.compensation.label, hex: PILLARS.compensation.hex },
};

const PILLAR_OPTS: [string, string][] = [
  ["overall", "All Pillars"],
  ...PILLAR_ORDER.map((p) => [p, PILLARS[p].label] as [string, string]),
];

const TIME_OPTS: [string, string][] = [
  ["1M", "1 Month"], ["3M", "3 Months"], ["6M", "6 Months"], ["1Y", "1 Year"], ["All", "All time"],
];

function LegendDot({ color, dashed, label }: { color: string; dashed?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block h-0.5 w-3.5 rounded"
        style={dashed ? { borderTop: `2px dashed ${color}` } : { background: color, height: 2.5 }}
      />
      <span className="text-[9px] text-ink-3">{label}</span>
    </div>
  );
}

/**
 * Trend card: area-gradient line with Org/Dept/Industry reference lines, plus
 * pillar + time filters. The TIME filter is controlled by the parent (so it can
 * refresh score + pillars + chart together); the PILLAR filter is local.
 */
export function TrendChart({
  data,
  window,
  onWindowChange,
  accent,
}: {
  data: TrendPoint[];
  window?: Window;
  onWindowChange?: (w: Window) => void;
  accent?: string;
}) {
  const [series, setSeries] = useState<Series>("overall");
  const meta = SERIES_META[series];
  const color = accent ?? meta.hex;
  const last = data[data.length - 1];

  return (
    <div className="rounded-card bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-brand">Trend</p>
        <div className="flex gap-1.5">
          {!accent && <CustomDropdown value={series} onChange={(v) => setSeries(v as Series)} options={PILLAR_OPTS} />}
          {onWindowChange && (
            <CustomDropdown value={window ?? "3M"} onChange={(v) => onWindowChange(v as Window)} options={TIME_OPTS} />
          )}
        </div>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${series}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#B0B3C6" }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fontSize: 10, fill: "#C8C8DC" }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #EDE8FF", fontSize: 12 }}
              formatter={(v) => [Number(v).toFixed(1), meta.label]}
            />
            {last && <ReferenceLine y={last.orgAvg} stroke="#C4BCFF" strokeDasharray="4 3" />}
            {last && <ReferenceLine y={last.deptAvg} stroke="#7EC8A4" strokeDasharray="3 4" />}
            {last && <ReferenceLine y={last.industryAvg} stroke="#F0B429" strokeDasharray="2 5" />}
            <Area
              type="monotone"
              dataKey={series}
              stroke={color}
              strokeWidth={2.4}
              fill={`url(#grad-${series})`}
              dot={{ r: 2.5, fill: color, stroke: "#fff", strokeWidth: 1.5 }}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2.5">
        <LegendDot color={color} label="Your score" />
        <LegendDot color="#C4BCFF" dashed label={`Org (${last?.orgAvg ?? "–"})`} />
        <LegendDot color="#7EC8A4" dashed label={`Dept (${last?.deptAvg ?? "–"})`} />
        <LegendDot color="#F0B429" dashed label={`Industry (${last?.industryAvg ?? "–"})`} />
      </div>
    </div>
  );
}
