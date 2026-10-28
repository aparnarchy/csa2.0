"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AIInsight,
  BigScore,
  Card,
  CEO_NAV,
  EmptyScoreCard,
  GradientHeader,
  InsightBarRow,
  LeaverNote,
  Mascot,
  PillarCard,
  PillarInfo,
  ScreenShell,
  SegmentedToggle,
  TrendChart,
  WINS_LABEL,
  WORRIES_LABEL,
  ShowMoreButton,
  visibleRows,
} from "@/components/kit";
import { type CeoDashboard, type Window } from "@/lib/data";
import { COPY, fill } from "@/lib/copy";
import { ANONYMISATION_FLOOR } from "@/lib/scoring";
import { getCeoDashboardAction, getCeoInsightAction } from "./actions";
import { HEADER_MASCOT_SIZE, mascotForScore } from "@/lib/mascot";
import { STRENGTH_CUTOFF } from "@/lib/pillars";
import type { PillarId, SessionUser } from "@/lib/types";
import { CeoPillarDetailView } from "./CeoPillarDetailView";
import { keepCurrent, withRetry } from "@/lib/retry";

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
  from,
}: {
  session: SessionUser;
  scope: string;
  initial: CeoDashboard;
  initialInsight: string | null;
  /** Where this screen was opened from, so "back" returns there instead of
      always assuming the Org dashboard — it's also entered from Insights'
      department bar chart. */
  from?: string;
}) {
  const router = useRouter();
  const [window, setWindow] = useState<Window>("3M");
  const [data, setData] = useState<CeoDashboard>(initial);
  const [aiText, setAiText] = useState<string | null>(initialInsight);
  const [selectedPillar, setSelectedPillar] = useState<PillarId | null>(null);
  const [scTab, setScTab] = useState<"strengths" | "concerns">("strengths");
  const [scShowAll, setScShowAll] = useState(false);
  // undefined = nothing chosen yet → the first row starts open.
  const [scOpenId, setScOpenId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    withRetry(() => getCeoDashboardAction(scope, window)).then(setData, keepCurrent);
    withRetry(() => getCeoInsightAction(scope, window)).then(setAiText, keepCurrent);
  }, [scope, window]);

  const isPlay = session.themeMode === "play";
  const up = (data.delta ?? 0) >= 0;
  const back =
    from === "insights"
      ? { label: "Insights", onClick: () => router.push("/dashboard/ceo-hr/insights") }
      : { label: "Org dashboard", onClick: () => router.push("/dashboard/ceo-hr") };

  const scSorted = [...data.questions].sort((a, b) => b.score - a.score);
  const scStrengths = scSorted.filter((q) => q.score > STRENGTH_CUTOFF);
  const scConcerns = scSorted.filter((q) => q.score <= STRENGTH_CUTOFF).reverse();
  const scShownAll = scTab === "strengths" ? scStrengths : scConcerns;
  const scShown = visibleRows(scShownAll, scShowAll);

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
        back={back}
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
        <EmptyScoreCard message={data.reason ?? fill(COPY.mood.noDataTeam, { floor: ANONYMISATION_FLOOR })} />
      ) : (
        <>
          <Card>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <BigScore score={data.score} caption={`${data.scopeLabel} score`} />
                <p className="mt-1 text-xs text-ink-3">
                  {data.peopleCount} people
                  {data.percentile != null && ` · ${data.percentile}th percentile`}
                </p>
                <LeaverNote count={data.leaverCount} />
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
            <PillarInfo className="mt-3" />
          </Card>

          <AIInsight text={aiText ?? undefined} />

          {/* Strengths & Concerns — same shape as every other dashboard
              (SegmentedToggle + InsightBarRow over real, anonymised
              per-question scores), before Trend like everywhere else. */}
          <Card>
            <p className="mb-3 text-sm font-bold text-brand">Insights</p>
            <div className="mb-4">
              <SegmentedToggle
                value={scTab}
                onChange={(v) => {
                  setScTab(v);
                  setScOpenId(undefined);
                  setScShowAll(false);
                }}
                options={[
                  { value: "strengths", label: WINS_LABEL },
                  { value: "concerns", label: WORRIES_LABEL },
                ]}
              />
            </div>
            {scShown.map((q, qi) => (
              <InsightBarRow
                key={q.id}
                q={q}
                isStrength={scTab === "strengths"}
                open={scOpenId === undefined ? qi === 0 : scOpenId === q.id}
                onToggle={() => setScOpenId((cur) => ((cur === undefined ? qi === 0 : cur === q.id) ? null : q.id))}
              />
            ))}
            <ShowMoreButton total={scShownAll.length} expanded={scShowAll} onToggle={() => setScShowAll((v) => !v)} />
            {scShown.length === 0 && (
              <p className="text-xs text-ink-4">
                {scTab === "strengths" ? COPY.mood.noStrengths : COPY.mood.noConcerns}
              </p>
            )}
          </Card>

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

          {data.trendReady && <TrendChart data={data.trend} window={window} onWindowChange={setWindow} />}

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
