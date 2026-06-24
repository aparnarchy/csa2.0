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
  // Persona voice applies only in Play mode; Professional uses neutral copy.
  const persona = session.themeMode === "play" ? session.persona : undefined;
  const insight = buildEmployeeInsight(data, persona);
  const rca = buildRootAnalysis(data, persona);
  const firstName = (session.name || "there").trim().split(/\s+/)[0];

  return (
    <ScreenShell active="insights">
      {/* Title card — kept: greeting + "Dashboard" + insight + mascot (sub-screen sizing). */}
      <GradientHeader
        eyebrow="My Dashboard"
        title={`Hey ${firstName}`}
        avatar={<Mascot state={mascotForScore(data.overall, data.enoughData)} size={HEADER_MASCOT_SIZE} float={false} sparkle={false} />}
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
          {/* Bright Spot / Watch Out — GSAP-animated wavy blobs (tap to expand). */}
          {insight.brightSpot && insight.watchOut && (
            <div className="pt-4 mb-7">
              <ScoreCircles
                bright={{ score: insight.brightSpot.score, pillar: insight.brightSpot.label }}
                watch={{ score: insight.watchOut.score, pillar: insight.watchOut.label }}
              />
            </div>
          )}

          {/* Insight box — leads with the recommendation; the prediction is a
              quiet supporting line; "Let's find out why" is the clear action
              that opens the immersive Find the Root journey. */}
          {rca.available && (
            <div className="rounded-card bg-lav-soft p-5 shadow-card">
              <div className="flex items-start gap-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-3">
                    💡 Try this week
                  </p>
                  <p className="mt-1.5 font-display text-[17px] font-black leading-snug text-ink">
                    {insight.action ?? "Take a closer look at your weakest area this week."}
                  </p>
                  {rca.feelings.length > 0 && (
                    <p className="mt-2.5 text-[12px] text-ink-3">
                      You might be feeling{" "}
                      <span className="font-semibold text-ink-2">
                        {rca.feelings.slice(0, 2).join(" · ").toLowerCase()}
                      </span>
                    </p>
                  )}
                </div>
                <Mascot state="sad" size={88} sparkle={false} float={false} />
              </div>
              <button
                type="button"
                onClick={() => setShowRoot(true)}
                className="mt-4 w-full rounded-2xl bg-brand py-3.5 font-display text-sm font-black text-white transition active:scale-[0.98]"
              >
                Let&apos;s find out why →
              </button>
            </div>
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
