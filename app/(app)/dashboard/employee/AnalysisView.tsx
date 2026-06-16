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
  StatCircle,
  TrendChart,
} from "@/components/kit";
import { getEmployeeScores, type EmployeeScores, type Window } from "@/lib/data";
import { mascotForScore } from "@/lib/mascot";
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
  const insight = buildEmployeeInsight(data);
  const rca = buildRootAnalysis(data);
  const firstName = (session.name || "there").trim().split(/\s+/)[0];

  return (
    <ScreenShell active="insights">
      {/* Title card — kept: greeting + "Dashboard" + insight + mascot (sub-screen sizing). */}
      <GradientHeader
        eyebrow="My Dashboard"
        title={`Hey ${firstName} 👋`}
        avatar={<Mascot state={mascotForScore(data.overall, data.enoughData)} size={168} />}
        avatarClassName="absolute right-1 top-8 z-10"
        className="min-h-[200px]"
      >
        {data.enoughData && data.overall !== null && (
          <p className="mt-3 max-w-[58%] font-display text-lg font-black leading-tight text-brand">
            {insight.headline}.
          </p>
        )}
      </GradientHeader>

      {!data.enoughData || data.overall === null ? (
        <NotEnoughData />
      ) : (
        <>
          {/* Bright Spot / Watch Out — wavy morphing blobs. */}
          <div className="grid grid-cols-2 gap-3">
            {insight.brightSpot && (
              <StatCircle
                kind="bright"
                label="Your Bright Spot"
                score={insight.brightSpot.score}
                pillar={insight.brightSpot.label}
              />
            )}
            {insight.watchOut && (
              <StatCircle
                kind="watch"
                label="Watch out"
                score={insight.watchOut.score}
                pillar={insight.watchOut.label}
              />
            )}
          </div>

          {/* Oracle guessing box → opens the immersive Find the Root journey. */}
          {rca.available && (
            <button
              type="button"
              onClick={() => setShowRoot(true)}
              className="w-full rounded-card bg-lav-soft p-5 text-left shadow-card transition active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
                    <span aria-hidden>🔮</span> I&apos;m guessing you&apos;re currently feeling…
                  </p>
                  <div className="mt-2 space-y-1">
                    {rca.feelings.map((f) => (
                      <p key={f} className="font-display text-[15px] font-black uppercase tracking-wide text-brand">
                        {f}
                      </p>
                    ))}
                  </div>
                </div>
                <Mascot state="sad" size={104} sparkle={false} />
              </div>
              <span className="mt-2 block text-right text-xs font-bold text-brand">Let&apos;s find out why →</span>
            </button>
          )}

          {/* Try this week — one concrete action from the lowest pillar. */}
          {insight.action && (
            <Card>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand">💡 Try this week</p>
              <p className="text-[13px] leading-relaxed text-ink-2">{insight.action}</p>
            </Card>
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
