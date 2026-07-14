"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AIInsight,
  BigScore,
  Card,
  CustomDropdown,
  GradientHeader,
  Mascot,
  NotEnoughData,
  PillarCard,
  ScreenShell,
  SegmentedToggle,
  TrendChart,
} from "@/components/kit";
import { type CeoDashboard, type Window } from "@/lib/data";
import { getCeoDashboardAction, getCeoInsightAction } from "./actions";
import { HEADER_MASCOT_SIZE, mascotForScore } from "@/lib/mascot";
import { PILLARS } from "@/lib/pillars";
import type { PillarId, SessionUser } from "@/lib/types";

type HighLow = "high" | "low";

const SCOPE_EYEBROW: Record<"org" | "dept" | "team", string> = {
  org: "🏢 Organisation",
  dept: "🏬 Department",
  team: "👥 Team",
};

export function CeoHrView({
  session,
  initial,
  initialInsight,
}: {
  session: SessionUser;
  initial: CeoDashboard;
  initialInsight: string | null;
}) {
  const [window, setWindow] = useState<Window>("3M");
  const [scope, setScope] = useState<string>(initial.scope);
  const [data, setData] = useState<CeoDashboard>(initial);
  const [aiText, setAiText] = useState<string | null>(initialInsight);
  const [highLow, setHighLow] = useState<HighLow>("low");

  // Scope or time-window change recomputes the whole aggregate via a server action
  // (real D1). Privacy + the anonymisation floor live server-side.
  useEffect(() => {
    getCeoDashboardAction(scope, window).then(setData);
    getCeoInsightAction(scope, window).then(setAiText);
  }, [scope, window]);

  const isPlay = session.themeMode === "play";
  const firstName = (session.name || "there").trim().split(/\s+/)[0];
  const up = (data.delta ?? 0) >= 0;

  // High/Low toggle: rank pillars strongest- or weakest-first.
  const ranked = useMemo(() => {
    const withScore = data.pillars.filter((p) => p.score !== null);
    return [...withScore].sort((a, b) =>
      highLow === "high" ? (b.score ?? 0) - (a.score ?? 0) : (a.score ?? 0) - (b.score ?? 0),
    );
  }, [data.pillars, highLow]);

  const dropdownOptions = data.options.map((o) => [o.value, o.label] as [string, string]);

  return (
    <ScreenShell active="insights">
      {/* Header — Play: lavender card + mascot; Professional: gradient, no mascot. */}
      {isPlay ? (
        <GradientHeader
          eyebrow="🏢 Org health"
          title={`Hi ${firstName}`}
          avatar={
            <Mascot
              state={mascotForScore(data.score, data.enoughData)}
              size={HEADER_MASCOT_SIZE}
              float={false}
              sparkle={false}
            />
          }
          className="flex min-h-[180px] flex-col justify-center"
        >
          <p className="mt-2 text-sm font-bold text-brand">
            Company-wide aggregates — never an individual.
          </p>
        </GradientHeader>
      ) : (
        <div
          className="rounded-card px-5 py-6"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <p className="text-xs font-semibold text-brand/70">🏢 Org health</p>
          <h1 className="mt-1 font-display text-[30px] font-black leading-tight text-brand">
            Hi {firstName}
          </h1>
          <p className="mt-2 font-display text-base font-black leading-snug text-brand-light">
            Company-wide aggregates — never an individual.
          </p>
        </div>
      )}

      {/* Scope drill-down: org → department → team */}
      <div className="flex items-center justify-between px-1">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-3">Viewing</p>
          <p className="truncate font-display text-base font-black text-ink">
            {SCOPE_EYEBROW[data.scopeKind]} · {data.scopeLabel}
          </p>
        </div>
        <CustomDropdown value={scope} onChange={setScope} options={dropdownOptions} align="right" />
      </div>

      {!data.enoughData || data.score === null ? (
        <NotEnoughData message={data.reason} />
      ) : (
        <>
          {/* Score + delta + headcount + pillars */}
          <Card>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <BigScore score={data.score} caption={`${data.scopeLabel} score`} />
                <p className="mt-1 text-xs text-ink-3">
                  {data.peopleCount} people · {data.percentile}th percentile
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
            <div className="grid grid-cols-2 gap-2">
              {data.pillars.map((p) => (
                <PillarCard key={p.pillarId} data={p} />
              ))}
            </div>
          </Card>

          {/* AI insight — LLM summary of the aggregates, cached in D1 */}
          <AIInsight text={aiText ?? undefined} />

          {/* Trend — scope vs org / dept / industry */}
          <TrendChart data={data.trend} window={window} onWindowChange={setWindow} />

          {/* Action-impact summary — how much feedback turned into action */}
          {data.impact && (
            <Card>
              <p className="mb-1 text-sm font-bold text-brand">Action impact</p>
              <p className="mb-3 text-xs text-ink-3">
                Feedback actions taken across {data.scopeLabel.toLowerCase()} and their effect.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <ImpactStat value={data.impact.submitted} label="Actions submitted" />
                <ImpactStat value={data.impact.resolved} label="Resolved" />
                <ImpactStat value={`${data.impact.resolutionPct}%`} label="Resolution rate" />
              </div>
              <p className="mt-3 rounded-xl bg-lav-light px-3 py-2.5 text-xs text-ink-2">
                <span className="font-bold text-brand">{data.impact.pillarsImproved}</span> of 4
                pillars are trending up since these actions landed.
              </p>
            </Card>
          )}

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

          <p className="pb-2 text-center text-[11px] text-ink-4">
            Aggregates only. No participation rate, and nothing here can identify an individual.
          </p>
        </>
      )}
    </ScreenShell>
  );
}

function ImpactStat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-xl bg-lav-light px-2 py-3 text-center">
      <span className="block font-display text-[24px] font-black leading-none text-[#8B82F6]">
        {value}
      </span>
      <p className="mt-1 text-[10px] leading-tight text-ink-3">{label}</p>
    </div>
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
