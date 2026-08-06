"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AIInsight,
  BigScore,
  Card,
  GradientHeader,
  Mascot,
  NotEnoughData,
  PillarCard,
  ScreenShell,
  TrendChart,
  CEO_NAV,
} from "@/components/kit";
import { type CeoDashboard, type Window } from "@/lib/data";
import { getCeoDashboardAction, getCeoInsightAction } from "./actions";
import { HEADER_MASCOT_SIZE, mascotForScore } from "@/lib/mascot";
import type { PillarId, SessionUser } from "@/lib/types";
import { CeoPillarDetailView } from "./CeoPillarDetailView";

/**
 * The department (or team) "head view" — reached by tapping a panel on the org
 * dashboard. Same content the old combined CEO/HR screen showed for a scope
 * (score + pillars + AI insight + action impact + trend), just entered by
 * drilling down from the org dashboard instead of a dropdown, with a back
 * button instead. Pillar ranking lives in the Insights tab now, not here.
 */
export function DeptDetailView({
  session,
  scope,
  initial,
  initialInsight,
}: {
  session: SessionUser;
  scope: string;
  initial: CeoDashboard;
  initialInsight: string | null;
}) {
  const router = useRouter();
  const [window, setWindow] = useState<Window>("3M");
  const [data, setData] = useState<CeoDashboard>(initial);
  const [aiText, setAiText] = useState<string | null>(initialInsight);
  const [selectedPillar, setSelectedPillar] = useState<PillarId | null>(null);

  useEffect(() => {
    getCeoDashboardAction(scope, window).then(setData);
    getCeoInsightAction(scope, window).then(setAiText);
  }, [scope, window]);

  const isPlay = session.themeMode === "play";
  const up = (data.delta ?? 0) >= 0;

  if (selectedPillar) {
    return (
      <ScreenShell active="dashboard" navItems={CEO_NAV}>
        <CeoPillarDetailView scope={scope} pillarId={selectedPillar} onBack={() => setSelectedPillar(null)} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell active="dashboard" navItems={CEO_NAV}>
      <GradientHeader
        eyebrow={data.scopeKind === "dept" ? "🏬 Department" : "👥 Team"}
        title={data.scopeLabel}
        back={{ label: "Org dashboard", onClick: () => router.push("/dashboard/ceo-hr") }}
        avatar={
          isPlay ? (
            <Mascot
              state={mascotForScore(data.score, data.enoughData)}
              size={HEADER_MASCOT_SIZE}
              float={false}
              sparkle={false}
            />
          ) : undefined
        }
      />

      {!data.enoughData || data.score === null ? (
        <NotEnoughData message={data.reason} />
      ) : (
        <>
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

            {/* Pillar grid — aggregates only, tap through to pillar detail. */}
            <div className="-mx-1.5 grid grid-cols-4 gap-2">
              {data.pillars.map((p) => (
                <PillarCard
                  key={p.pillarId}
                  data={p}
                  onClick={p.score !== null ? () => setSelectedPillar(p.pillarId) : undefined}
                />
              ))}
            </div>
          </Card>

          <AIInsight text={aiText ?? undefined} />

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

          <TrendChart data={data.trend} window={window} onWindowChange={setWindow} />

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
