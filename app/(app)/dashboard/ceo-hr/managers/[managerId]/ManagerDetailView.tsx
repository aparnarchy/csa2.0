"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AIInsight,
  BigScore,
  Card,
  GradientHeader,
  NotEnoughData,
  PillarCard,
  CEO_NAV,
  ScreenShell,
  SegmentedToggle,
  TrendChart,
} from "@/components/kit";
import { type ManagerDetail, type Window } from "@/lib/data";
import { getManagerDetailAction, getManagerDetailInsightAction } from "../../actions";
import { PILLARS } from "@/lib/pillars";
import type { PillarId } from "@/lib/types";

type HighLow = "high" | "low";

/** A single manager's team detail, reached from the Insights tab / all-managers list. */
export function ManagerDetailView({
  initial,
  initialInsight,
}: {
  initial: ManagerDetail;
  initialInsight: string | null;
}) {
  const router = useRouter();
  const [window, setWindow] = useState<Window>("3M");
  const [data, setData] = useState<ManagerDetail>(initial);
  const [aiText, setAiText] = useState<string | null>(initialInsight);
  const [highLow, setHighLow] = useState<HighLow>("high");

  useEffect(() => {
    getManagerDetailAction(initial.managerId, window).then(setData);
    getManagerDetailInsightAction(initial.managerId, window).then(setAiText);
  }, [initial.managerId, window]);

  const up = (data.delta ?? 0) >= 0;

  const ranked = useMemo(() => {
    const withScore = data.pillars.filter((p) => p.score !== null);
    return [...withScore].sort((a, b) =>
      highLow === "high" ? (b.score ?? 0) - (a.score ?? 0) : (a.score ?? 0) - (b.score ?? 0),
    );
  }, [data.pillars, highLow]);

  return (
    <ScreenShell active="insights" navItems={CEO_NAV}>
      <GradientHeader
        eyebrow="👥 Team detail"
        title={data.name}
        back={{ label: "All managers", onClick: () => router.push("/dashboard/ceo-hr/managers") }}
      />

      {!data.enoughData || data.teamScore === null ? (
        <NotEnoughData message={data.reason} />
      ) : (
        <>
          <Card>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <BigScore score={data.teamScore} caption="Team score" />
                <p className="mt-1 text-xs text-ink-3">
                  {data.percentile}th percentile
                  {data.resolutionPct != null && ` · ${data.resolutionPct}% actions resolved`}
                </p>
              </div>
              {data.delta !== null && (
                <div
                  className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
                  style={{ background: up ? "#E8FBF0" : "#FDECEC", color: up ? "#059669" : "#DC2626" }}
                >
                  {up ? "↑" : "↓"} {Math.abs(data.delta).toFixed(1)}
                  <span className="text-[10px] font-medium text-ink-3">vs last</span>
                </div>
              )}
            </div>
            <div className="-mx-1.5 grid grid-cols-4 gap-2">
              {data.pillars.map((p) => (
                <PillarCard key={p.pillarId} data={p} />
              ))}
            </div>
          </Card>

          <AIInsight text={aiText ?? undefined} />

          <Card>
            <p className="mb-3 text-sm font-bold text-brand">Pillar ranking</p>
            <div className="mb-4 w-full">
              <SegmentedToggle<HighLow>
                value={highLow}
                onChange={setHighLow}
                options={[
                  { value: "high", label: "Strengths" },
                  { value: "low", label: "Watch-outs" },
                ]}
              />
            </div>
            <div className="space-y-2">
              {ranked.map((p) => (
                <PillarRankRow key={p.pillarId} pillarId={p.pillarId} score={p.score!} />
              ))}
            </div>
          </Card>

          <TrendChart data={data.trend} window={window} onWindowChange={setWindow} />

          <p className="pb-2 text-center text-[11px] text-ink-4">
            Aggregates only. Nothing here can identify an individual.
          </p>
        </>
      )}
    </ScreenShell>
  );
}

function PillarRankRow({ pillarId, score }: { pillarId: PillarId; score: number }) {
  const color = score >= 7 ? "#059669" : score >= 4 ? "#b45309" : "#dc2626";
  return (
    <div className="flex items-center gap-3">
      <p className="w-28 flex-shrink-0 text-[13px] font-semibold text-ink">{PILLARS[pillarId].label}</p>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-lav-soft">
        <div className="h-full rounded-full" style={{ width: `${score * 10}%`, background: color }} />
      </div>
      <span className="w-8 flex-shrink-0 text-right text-[13px] font-black" style={{ color }}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}
