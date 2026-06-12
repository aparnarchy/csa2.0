"use client";

import { useEffect, useState } from "react";
import {
  AIInsight,
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
import type { PillarId, SessionUser } from "@/lib/types";
import { PillarDetailView } from "./PillarDetailView";

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
  const [pctMode, setPctMode] = useState(0);
  const [selectedPillar, setSelectedPillar] = useState<PillarId | null>(null);

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

  const pctModes = [
    { label: "Org", value: data.percentiles.org },
    { label: "Dept", value: data.percentiles.dept },
    { label: "Industry", value: data.percentiles.industry },
  ];
  const pct = pctModes[pctMode % pctModes.length];

  const sortedQs = [...data.questions].sort((a, b) => b.score - a.score);
  const shownQs = tab === "strengths" ? sortedQs.slice(0, 3) : sortedQs.slice(-3).reverse();
  const up = (data.delta ?? 0) >= 0;

  return (
    <ScreenShell active="insights">
      <GradientHeader
        eyebrow="Individual"
        title={mode === "company" ? "My Dashboard" : "Overall Career Happiness"}
        subtitle={mode === "company" ? "Current company" : "Aggregate across your career"}
        avatar={<Mascot state={mascotForScore(data.overall, data.enoughData)} size={172} />}
      />

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
          <Card>
            <div className="mb-4 flex items-start justify-between">
              <BigScore score={data.overall} />

              <div className="flex flex-col items-end gap-2 pt-1.5">
                {data.delta !== null && (
                  <div
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
                    style={{ background: up ? "#E8FBF0" : "#FDECEC", color: up ? "#059669" : "#DC2626" }}
                  >
                    {up ? "↑" : "↓"} {Math.abs(data.delta).toFixed(1)}
                    <span className="text-[10px] font-medium text-ink-3">vs last</span>
                  </div>
                )}
                <div className="text-right">
                  <span className="font-display text-sm font-extrabold text-brand">{data.participation}%</span>
                  <p className="text-[10px] text-ink-3">participation</p>
                </div>
                <button type="button" onClick={() => setPctMode((m) => m + 1)} className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-sm text-brand-light">‹</span>
                    <span className="font-display text-[13px] font-extrabold text-ink">{pct.value}th</span>
                    <span className="text-sm text-brand-light">›</span>
                  </div>
                  <p className="text-[10px] text-ink-3">percentile / {pct.label}</p>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {data.pillars.map((p) => (
                <PillarCard key={p.pillarId} data={p} onClick={() => setSelectedPillar(p.pillarId)} />
              ))}
            </div>
          </Card>

          <AIInsight />

          <TrendChart data={data.trend} window={window} onWindowChange={setWindow} />

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
        </>
      )}
    </ScreenShell>
  );
}
