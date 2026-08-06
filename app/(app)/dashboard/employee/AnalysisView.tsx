"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { COPY } from "@/lib/copy";
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
import { type EmployeeScores, type Window } from "@/lib/data";
import { getEmployeeScoresAction } from "./actions";
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
  const router = useRouter();
  const [window, setWindow] = useState<Window>("3M");
  const [data, setData] = useState<EmployeeScores>(initial);
  const [tab, setTab] = useState<Tab>("strengths");
  const [selectedPillar, setSelectedPillar] = useState<PillarId | null>(null);
  const [showRoot, setShowRoot] = useState(false);
  /** Accordion: at most one question row is expanded at a time. */
  const [openId, setOpenId] = useState<string | null>(null);

  // Time filter refreshes score + pillars + chart together via a server action
  // (real aggregation over the user's own check-ins).
  useEffect(() => {
    getEmployeeScoresAction(window).then(setData);
  }, [window]);

  if (selectedPillar) {
    return (
      <ScreenShell active="insights">
        <PillarDetailView
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
      {/* Header — Play: lavender card + mascot + persona voice. Professional:
          a smaller card with a richer purple gradient and bigger, mascot-free
          welcome text (all in lilac to match the theme). */}
      {isPlay ? (
        <GradientHeader
          eyebrow={chrome.eyebrow}
          title={chrome.greeting(firstName)}
          avatar={
            <Mascot
              state={mascotForScore(data.overall, data.enoughData)}
              size={HEADER_MASCOT_SIZE}
              float={false}
              sparkle={false}
            />
          }
          className="flex min-h-[212px] flex-col justify-center"
        >
          {data.enoughData && data.overall !== null && (
            <p className="mt-3 font-display text-lg font-black leading-tight text-brand">
              {insight.headline}.
            </p>
          )}
        </GradientHeader>
      ) : (
        <div
          className="rounded-card px-5 py-6"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <p className="text-xs font-semibold text-brand/70">{chrome.eyebrow}</p>
          <h1 className="mt-1 font-display text-[34px] font-black leading-tight text-brand">
            {chrome.greeting(firstName)}
          </h1>
          {data.enoughData && data.overall !== null && (
            <p className="mt-2 font-display text-base font-black leading-snug text-brand-light">
              {insight.headline}.
            </p>
          )}
        </div>
      )}

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
                  bright={{ score: insight.brightSpot.score, pillar: insight.brightSpot.label, pillarId: insight.brightSpot.pillarId }}
                  watch={{ score: insight.watchOut.score, pillar: insight.watchOut.label, pillarId: insight.watchOut.pillarId }}
                  onSelect={setSelectedPillar}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPillar(insight.brightSpot!.pillarId)}
                  className="rounded-card bg-lav-soft p-4 text-left shadow-card transition active:scale-[0.98]"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">☀️ Bright spot</p>
                  <p className="mt-1 font-display text-3xl font-black leading-none text-brand">
                    {insight.brightSpot.score.toFixed(1)}
                  </p>
                  <p className="mt-1 text-xs text-brand/70">{insight.brightSpot.label}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPillar(insight.watchOut!.pillarId)}
                  className="rounded-card bg-lav-soft p-4 text-left shadow-card transition active:scale-[0.98]"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">⚠️ Watch out</p>
                  <p className="mt-1 font-display text-3xl font-black leading-none text-brand">
                    {insight.watchOut.score.toFixed(1)}
                  </p>
                  <p className="mt-1 text-xs text-brand/70">{insight.watchOut.label}</p>
                </button>
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

          {/* Happiness score + pillars first (unchanged), then Strengths/Concerns,
              then the trend chart (owner: only these two swapped places). */}
          <Card>
            {/* Delta rides beside the numeral (via BigScore's `trailing` slot)
                so score, badge and message read as one block. */}
            <div className="mb-4">
              <BigScore
                score={data.overall}
                trailing={
                  data.delta !== null ? (
                    <div
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{ background: up ? "#E8FBF0" : "#FDECEC", color: up ? "#059669" : "#DC2626" }}
                    >
                      {up ? "↑" : "↓"} {Math.abs(data.delta).toFixed(1)}
                      <span className="text-[10px] font-medium text-ink-3">vs last</span>
                    </div>
                  ) : undefined
                }
              />
            </div>

            <div className="-mx-1.5 grid grid-cols-4 gap-2">
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
                onChange={(v) => {
                  setTab(v);
                  setOpenId(null);
                }}
                options={[
                  { value: "strengths", label: "💪 Strengths" },
                  { value: "concerns", label: "⚠️ Concerns" },
                ]}
              />
            </div>
            {shownQs.map((q) => (
              <InsightBarRow
                key={q.id}
                q={q}
                isStrength={tab === "strengths"}
                open={openId === q.id}
                onToggle={() => setOpenId((cur) => (cur === q.id ? null : q.id))}
              />
            ))}
          </Card>

          <TrendChart data={data.trend} window={window} onWindowChange={setWindow} />

          {/* Career history — the second way in, alongside the Profile link. */}
          <button
            type="button"
            onClick={() => router.push("/career")}
            className="w-full rounded-card border border-lav-mid bg-white p-4 text-left shadow-card transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-lav-soft text-xl">
                🗂️
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-black leading-tight text-ink">
                  {COPY.career.insightsLinkTitle}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-3">{COPY.career.insightsLinkSub}</p>
              </div>
              <span className="flex-shrink-0 text-brand-light">→</span>
            </div>
          </button>
        </>
      )}

      {showRoot && rca.available && (
        <RootJourney analysis={rca} onClose={() => setShowRoot(false)} />
      )}
    </ScreenShell>
  );
}
