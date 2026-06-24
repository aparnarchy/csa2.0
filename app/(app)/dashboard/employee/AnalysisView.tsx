"use client";

import { useEffect, useState } from "react";
import {
  BigScore,
  Card,
  GradientHeader,
  InsightBarRow,
  Mascot,
  NotEnoughData,
  PillarCard,
  ScreenShell,
  SegmentedToggle,
  TrendChart,
} from "@/components/kit";
import { ScoreCircles } from "./ScoreCircles";
import { getEmployeeScores, type EmployeeScores, type Window } from "@/lib/data";
import { HEADER_MASCOT_SIZE, mascotForScore } from "@/lib/mascot";
import { buildEmployeeInsight } from "@/lib/insight";
import { buildRootAnalysis } from "@/lib/rca";
import { chromeFor } from "@/lib/voice";
import type { PillarId, SessionUser } from "@/lib/types";
import { PillarDetailView } from "./PillarDetailView";
import { RootJourney } from "./RootJourney";

type Tab = "strengths" | "concerns";

export function AnalysisView({
  session,
  initial,
}: {
  session: SessionUser;
  initial: EmployeeScores;
}) {
  const [window, setWindow] = useState<Window>("3M");
  const [data, setData] = useState<EmployeeScores>(initial);
  const [tab, setTab] = useState<Tab>("concerns");
  const [selectedPillar, setSelectedPillar] = useState<PillarId | null>(null);
  const [showRoot, setShowRoot] = useState(false);

  // Time filter refreshes score + pillars + chart together.
  // (Sample data is recomputed client-side; becomes a server action on real D1.)
  useEffect(() => {
    getEmployeeScores(session, session.id, window).then(setData);
  }, [session, window]);

  if (selectedPillar) {
    return (
      <ScreenShell active="insights">
        <PillarDetailView
          session={session}
          pillarId={selectedPillar}
          onBack={() => setSelectedPillar(null)}
        />
      </ScreenShell>
    );
  }

  const sortedQs = [...data.questions].sort((a, b) => b.score - a.score);
  const shownQs = tab === "strengths" ? sortedQs.slice(0, 3) : sortedQs.slice(-3).reverse();
  const up = (data.delta ?? 0) >= 0;
  // Mode = design only. Play shows the fun look (mascot, blob circles, persona
  // voice); Professional is a plain, serious dashboard with neutral copy.
  const isPlay = session.themeMode === "play";
  const persona = isPlay ? session.persona : undefined;
  const insight = buildEmployeeInsight(data, persona);
  const rca = buildRootAnalysis(data, persona);
  const chrome = chromeFor(persona);
  const firstName = (session.name || "there").trim().split(/\s+/)[0];

  return (
    <ScreenShell active="insights">
      {/* Header — same lavender theme in both modes. Play adds the mascot and
          speaks in the persona's voice; Professional drops the mascot. */}
      <GradientHeader
        eyebrow={chrome.eyebrow}
        title={chrome.greeting(firstName)}
        avatar={
          isPlay ? (
            <Mascot
              state={mascotForScore(data.overall, data.enoughData)}
              size={HEADER_MASCOT_SIZE}
              float={false}
              sparkle={false}
            />
          ) : undefined
        }
        className="flex min-h-[212px] flex-col justify-center"
      >
        {data.enoughData && data.overall !== null && (
          <p className="mt-3 font-display text-lg font-black leading-tight text-brand">
            {insight.headline}.
          </p>
        )}
      </GradientHeader>

      {!data.enoughData || data.overall === null ? (
        <NotEnoughData />
      ) : (
        <>
          {/* Bright Spot / Watch Out — Play: animated wavy blobs. Professional:
              plain stat cards. */}
          {insight.brightSpot && insight.watchOut && (
            isPlay ? (
              <div className="mb-7 pt-4">
                <ScoreCircles
                  bright={{ score: insight.brightSpot.score, pillar: insight.brightSpot.label }}
                  watch={{ score: insight.watchOut.score, pillar: insight.watchOut.label }}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-card bg-lav-soft p-4 shadow-card">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Bright spot</p>
                  <p className="mt-1 font-display text-3xl font-black leading-none text-brand">
                    {insight.brightSpot.score.toFixed(1)}
                  </p>
                  <p className="mt-1 text-xs text-ink-2">{insight.brightSpot.label}</p>
                </div>
                <div className="rounded-card bg-lav-soft p-4 shadow-card">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Watch out</p>
                  <p className="mt-1 font-display text-3xl font-black leading-none text-brand">
                    {insight.watchOut.score.toFixed(1)}
                  </p>
                  <p className="mt-1 text-xs text-ink-2">{insight.watchOut.label}</p>
                </div>
              </div>
            )
          )}

          {/* Insight box — leads with the recommendation; the CTA opens the
              root-cause view. Play adds the mascot + a persona feeling line. */}
          {rca.available && (
            isPlay ? (
              <div className="rounded-card bg-lav-soft p-5 shadow-card">
                <div className="flex items-start gap-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-brand">
                      {chrome.tryLabel}
                    </p>
                    <p className="mt-1.5 font-display text-[17px] font-black leading-snug text-brand">
                      {insight.action ?? "Take a closer look at your weakest area this week."}
                    </p>
                    {rca.feelings.length > 0 && (
                      <p className="mt-2.5 text-[12px] text-brand/70">
                        {chrome.feelingsLead}{" "}
                        <span className="font-semibold text-brand">
                          {rca.feelings.slice(0, 2).join(" · ").toLowerCase()}
                        </span>
                      </p>
                    )}
                  </div>
                  <Mascot state="sad" size={101} sparkle={false} float={false} />
                </div>
                <button
                  type="button"
                  onClick={() => setShowRoot(true)}
                  className="mt-4 w-full rounded-2xl bg-brand py-3.5 font-display text-sm font-black text-white transition active:scale-[0.98]"
                >
                  {chrome.cta}
                </button>
              </div>
            ) : (
              <div className="rounded-card bg-lav-soft p-5 shadow-card">
                <p className="text-[11px] font-bold uppercase tracking-wide text-brand">
                  {chrome.tryLabel}
                </p>
                <p className="mt-1.5 font-display text-[17px] font-black leading-snug text-brand">
                  {insight.action ?? "Take a closer look at your weakest area this week."}
                </p>
                <button
                  type="button"
                  onClick={() => setShowRoot(true)}
                  className="mt-3 text-sm font-bold text-brand"
                >
                  {chrome.cta}
                </button>
              </div>
            )
          )}

          {/* ── Everything below is unchanged ───────────────────────────────── */}
          <Card>
            <div className="mb-4 flex items-start justify-between">
              <BigScore score={data.overall} />
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

            <div className="grid grid-cols-2 gap-2">
              {data.pillars.map((p) => (
                <PillarCard key={p.pillarId} data={p} onClick={() => setSelectedPillar(p.pillarId)} />
              ))}
            </div>
          </Card>

          <Card>
            <p className="mb-3 text-sm font-bold text-brand">Insights</p>
            <div className="mb-4">
              <SegmentedToggle
                value={tab}
                onChange={setTab}
                options={[
                  { value: "strengths", label: "💪 Strengths" },
                  { value: "concerns", label: "⚠️ Concerns" },
                ]}
              />
            </div>
            {shownQs.map((q) => (
              <InsightBarRow key={q.id} q={q} isStrength={tab === "strengths"} />
            ))}
          </Card>

          <TrendChart data={data.trend} window={window} onWindowChange={setWindow} />
        </>
      )}

      {showRoot && rca.available && (
        <RootJourney analysis={rca} onClose={() => setShowRoot(false)} />
      )}
    </ScreenShell>
  );
}
