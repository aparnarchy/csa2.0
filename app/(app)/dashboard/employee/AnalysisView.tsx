"use client";

import Link from "next/link";
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
import { getEmployeeScores, type EmployeeScores, type Window } from "@/lib/data";
import { mascotForScore } from "@/lib/mascot";
import { buildEmployeeInsight } from "@/lib/insight";
import { buildRootAnalysis } from "@/lib/rca";
import type { PillarId, SessionUser } from "@/lib/types";
import { PillarDetailView } from "./PillarDetailView";
import { RootJourney } from "./RootJourney";

type Mode = "company" | "career";
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
  const [mode, setMode] = useState<Mode>("company");
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
  const insight = buildEmployeeInsight(data);
  const rca = buildRootAnalysis(data);
  const firstName = (session.name || "there").trim().split(/\s+/)[0];

  return (
    <ScreenShell active="insights">
      <GradientHeader
        title={mode === "company" ? `Hey ${firstName} 👋` : "Overall Career Happiness"}
        subtitle={mode === "company" ? "Kissflow" : "Across your career"}
        avatar={<Mascot state={mascotForScore(data.overall, data.enoughData)} size={148} />}
      />

      {mode === "company" && (
        <Link
          href="/check-in"
          className="flex items-center justify-between rounded-card bg-brand px-5 py-3.5 shadow-card transition active:scale-[0.99]"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-white">
            <span aria-hidden>📝</span> Your weekly check-in is ready
          </span>
          <span className="text-sm font-bold text-white">Start →</span>
        </Link>
      )}

      <Card>
        <SegmentedToggle
          value={mode}
          onChange={setMode}
          options={[
            { value: "company", label: "Current Company" },
            { value: "career", label: "Overall Career" },
          ]}
        />
      </Card>

      {mode === "career" ? (
        <NotEnoughData message="Overall Career builds from your career history — available once onboarding and past-company check-ins are in." />
      ) : !data.enoughData || data.overall === null ? (
        <NotEnoughData />
      ) : (
        <>
          {/* Insight-first hero: short headline + scannable tiles, made to pop. */}
          <div
            className="rounded-card p-5 shadow-card"
            style={{ background: "linear-gradient(160deg, #EFEAFF 0%, #E2D8FF 100%)" }}
          >
            <p className="font-display text-[26px] font-black leading-tight text-brand">
              <span aria-hidden>{insight.emoji}</span> {insight.headline}
            </p>

            {(insight.brightSpot || insight.watchOut) && (
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {insight.brightSpot && (
                  <div className="rounded-2xl bg-white/85 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-3">✨ Bright spot</p>
                    <p className="mt-1 text-xs font-bold text-ink">{insight.brightSpot.label}</p>
                    <p className="font-display text-2xl font-black leading-none text-brand">
                      {insight.brightSpot.score.toFixed(1)}
                    </p>
                  </div>
                )}
                {insight.watchOut && (
                  <div className="rounded-2xl bg-white/85 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-3">👀 Watch out</p>
                    <p className="mt-1 text-xs font-bold text-ink">{insight.watchOut.label}</p>
                    <p className="font-display text-2xl font-black leading-none text-brand">
                      {insight.watchOut.score.toFixed(1)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {insight.comparison && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-xs font-bold text-brand">
                🎉 {insight.comparison}
              </div>
            )}

            {insight.action && (
              <div className="mt-3 rounded-2xl bg-white p-3.5">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand">💡 Try this week</p>
                <p className="text-[13px] leading-relaxed text-ink-2">{insight.action}</p>
              </div>
            )}
          </div>

          {/* Hook → opens the immersive Find the Root journey. */}
          {rca.available && (
            <button
              type="button"
              onClick={() => setShowRoot(true)}
              className="w-full rounded-card p-5 text-left shadow-card transition active:scale-[0.99]"
              style={{ background: "linear-gradient(135deg, #4A3DBF 0%, #7C6FFF 100%)" }}
            >
              <div className="flex items-center gap-4">
                <span className="beacon flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-xl">
                  🔎
                </span>
                <div className="min-w-0">
                  <p className="font-display text-[15px] font-black leading-snug text-white">{rca.hook.line}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/75">{rca.hook.sub}</p>
                </div>
              </div>
              <span className="mt-3.5 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold text-white">
                Find the root →
              </span>
            </button>
          )}

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

          {/* Trend chart moved to the very bottom (data for those who want it). */}
          <TrendChart data={data.trend} window={window} onWindowChange={setWindow} />
        </>
      )}

      {showRoot && rca.available && (
        <RootJourney analysis={rca} onClose={() => setShowRoot(false)} />
      )}
    </ScreenShell>
  );
}
