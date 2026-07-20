"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AIInsight,
  BigScore,
  Card,
  NotEnoughData,
  PillarCard,
  ScreenShell,
  SegmentedToggle,
  TrendChart,
} from "@/components/kit";
import { type ManagerDetail, type Window } from "@/lib/data";
import { getManagerDetailInsightAction, getReviewingManagerDetailAction } from "../actions";
import { PILLARS } from "@/lib/pillars";
import type { PillarId } from "@/lib/types";
import type { SessionUser } from "@/lib/types";

type HighLow = "high" | "low";

export function ManagerDetailView({
  session,
  initial,
  initialInsight,
}: {
  session: SessionUser;
  initial: ManagerDetail;
  initialInsight: string | null;
}) {
  const router = useRouter();
  const [window, setWindow] = useState<Window>("3M");
  const [data, setData] = useState<ManagerDetail>(initial);
  const [aiText, setAiText] = useState<string | null>(initialInsight);
  const [highLow, setHighLow] = useState<HighLow>("low");

  useEffect(() => {
    getReviewingManagerDetailAction(initial.managerId, window).then(setData);
    getManagerDetailInsightAction(initial.managerId, window).then(setAiText);
  }, [initial.managerId, window]);

  const isPlay = session.themeMode === "play";
  const up = (data.delta ?? 0) >= 0;

  // High/Low toggle: rank pillars strongest- or weakest-first.
  const ranked = useMemo(() => {
    const withScore = data.pillars.filter((p) => p.score !== null);
    return [...withScore].sort((a, b) =>
      highLow === "high" ? (b.score ?? 0) - (a.score ?? 0) : (a.score ?? 0) - (b.score ?? 0),
    );
  }, [data.pillars, highLow]);

  return (
    <ScreenShell active="insights">
      {/* Header — manager name + back. Lavender (Play) / gradient (Professional). */}
      {isPlay ? (
        <div className="rounded-card bg-lav-bg px-5 py-5">
          <button
            type="button"
            onClick={() => router.push("/dashboard/reviewing-manager")}
            className="mb-2 text-xs font-bold text-brand"
          >
            ← All managers
          </button>
          <p className="text-xs font-semibold text-brand/70">🔭 Team detail</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-ink">{data.name}</h1>
        </div>
      ) : (
        <div
          className="rounded-card px-5 py-5"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <button
            type="button"
            onClick={() => router.push("/dashboard/reviewing-manager")}
            className="mb-2 text-xs font-bold text-brand"
          >
            ← All managers
          </button>
          <p className="text-xs font-semibold text-brand/70">🔭 Team detail</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-brand">{data.name}</h1>
        </div>
      )}

      {!data.enoughData || data.teamScore === null ? (
        <NotEnoughData message={data.reason} />
      ) : (
        <>
          {/* Team score + delta + percentile + resolution */}
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

            {/* Pillar grid — aggregates only, no drill into individuals. */}
            <div className="-mx-1.5 grid grid-cols-4 gap-2">
              {data.pillars.map((p) => (
                <PillarCard key={p.pillarId} data={p} />
              ))}
            </div>
          </Card>

          {/* AI insight (team) — LLM summary of the aggregates, cached in D1 */}
          <AIInsight text={aiText ?? undefined} />

          {/* High / Low pillar ranking */}
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-brand">Pillar ranking</p>
              <div className="w-40">
                <SegmentedToggle<HighLow>
                  value={highLow}
                  onChange={setHighLow}
                  options={[
                    { value: "low", label: "Watch-outs" },
                    { value: "high", label: "Strengths" },
                  ]}
                />
              </div>
            </div>
            <div className="space-y-2">
              {ranked.map((p) => (
                <PillarRankRow key={p.pillarId} pillarId={p.pillarId} score={p.score!} />
              ))}
            </div>
          </Card>

          {/* Trend — team vs org / dept / industry */}
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
