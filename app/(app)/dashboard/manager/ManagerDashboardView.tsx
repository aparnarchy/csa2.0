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
  RecommendationCard,
  ScoreCircles,
  ScreenShell,
  TrendChart,
} from "@/components/kit";
import { getSampleRecommendation, type TeamAggregate, type Window } from "@/lib/data";
import { COPY, fill } from "@/lib/copy";
import { getTeamAggregateAction, getTeamInsightAction } from "./actions";
import { HEADER_MASCOT_SIZE, mascotForScore } from "@/lib/mascot";
import { PILLARS } from "@/lib/pillars";
import type { PillarId, SessionUser } from "@/lib/types";
import { TeamPillarDetailView } from "./TeamPillarDetailView";

export function ManagerDashboardView({
  session,
  initial,
  initialInsight,
}: {
  session: SessionUser;
  initial: TeamAggregate;
  initialInsight: string | null;
}) {
  const router = useRouter();
  const [window, setWindow] = useState<Window>("3M");
  const [data, setData] = useState<TeamAggregate>(initial);
  const [aiText, setAiText] = useState<string | null>(initialInsight);
  const [selectedPillar, setSelectedPillar] = useState<PillarId | null>(null);

  // Time filter recomputes the whole aggregate via a server action (real D1,
  // privacy-enforced). The team is resolved server-side to the signed-in manager.
  useEffect(() => {
    getTeamAggregateAction(window).then(setData);
    getTeamInsightAction(window).then(setAiText);
  }, [window]);

  const isPlay = session.themeMode === "play";
  const firstName = (session.name || "there").trim().split(/\s+/)[0];
  const up = (data.delta ?? 0) >= 0;

  // Pillars below 7 (and above the floor) get a recommendation, weakest first.
  const lowPillars = data.pillars
    .filter((p) => p.score !== null && p.score < 7)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

  // Team-level Bright Spot / Watch Out — same pattern as the employee dashboard,
  // just computed from the team's pillar averages instead of one person's.
  const scoredPillars = data.pillars.filter((p) => p.score !== null);
  const brightPillar = scoredPillars.length
    ? [...scoredPillars].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
    : null;
  const watchPillar = scoredPillars.length
    ? [...scoredPillars].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]
    : null;

  if (selectedPillar) {
    return (
      <ScreenShell active="insights">
        <TeamPillarDetailView pillarId={selectedPillar} onBack={() => setSelectedPillar(null)} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell active="insights">
      {/* Header — Play: lavender card + mascot; Professional: gradient card, no
          mascot. Same palette and fonts as every other screen. */}
      {isPlay ? (
        <GradientHeader
          eyebrow={COPY.managerDashboard.eyebrow}
          title={fill(COPY.managerDashboard.teamTitle, { name: firstName })}
          avatar={
            <Mascot
              state={mascotForScore(data.teamScore, data.enoughData)}
              size={HEADER_MASCOT_SIZE}
              float={false}
              sparkle={false}
            />
          }
          className="flex min-h-[180px] flex-col justify-center"
        >
          <p className="mt-2 text-sm font-bold text-brand">
            {COPY.managerDashboard.anonNote}
          </p>
        </GradientHeader>
      ) : (
        <div
          className="rounded-card px-5 py-6"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <p className="text-xs font-semibold text-brand/70">{COPY.managerDashboard.eyebrow}</p>
          <h1 className="mt-1 font-display text-[30px] font-black leading-tight text-brand">
            {fill(COPY.managerDashboard.teamTitle, { name: firstName })}
          </h1>
          <p className="mt-2 font-display text-base font-black leading-snug text-brand-light">
            {COPY.managerDashboard.anonNote}
          </p>
        </div>
      )}

      {!data.enoughData || data.teamScore === null ? (
        <NotEnoughData message={data.reason} />
      ) : (
        <>
          {/* Bright Spot / Watch Out — Play: the same animated wavy blobs as the
              employee dashboard, at team level (top/bottom scoring pillar).
              Professional: no equivalent here (matches employee, which also
              only shows this in Play). */}
          {isPlay && brightPillar && watchPillar && (
            <div className="mb-7 pt-4">
              <ScoreCircles
                bright={{
                  score: brightPillar.score!,
                  pillar: PILLARS[brightPillar.pillarId].label,
                  pillarId: brightPillar.pillarId,
                }}
                watch={{
                  score: watchPillar.score!,
                  pillar: PILLARS[watchPillar.pillarId].label,
                  pillarId: watchPillar.pillarId,
                }}
                onSelect={setSelectedPillar}
              />
            </div>
          )}

          {/* Team score + delta + participation */}
          <Card>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <BigScore score={data.teamScore} />
                <p className="mt-1 text-xs text-ink-3">{fill(COPY.managerDashboard.peopleParticipation, { count: data.reporteeCount, pct: data.participation })}</p>
              </div>
              {data.delta !== null && (
                <div
                  className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
                  style={{ background: up ? "#E8FBF0" : "#FDECEC", color: up ? "#059669" : "#DC2626" }}
                >
                  {up ? "↑" : "↓"} {Math.abs(data.delta).toFixed(1)}
                  <span className="text-[10px] font-medium text-ink-3">{COPY.managerDashboard.vsLast}</span>
                </div>
              )}
            </div>

            {/* Pillar cards — aggregates only, no drill into individuals. Tap
                through to the team-level pillar detail (same shape as the
                employee dashboard's). Pillars with no data yet aren't clickable. */}
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

          {/* AI insight (team) — LLM summary of the aggregates, cached in D1.
              The mascot next to it was a mismatch (its mood is score-based
              and often didn't match the insight's actual content) — dropped,
              same shared box as every other dashboard now. */}
          <AIInsight text={aiText ?? undefined} />

          {/* Recommendations — one per low pillar, weakest first */}
          {lowPillars.length > 0 && (
            <Card>
              <p className="mb-1 text-sm font-bold text-brand">{COPY.managerDashboard.whereToFocus}</p>
              <p className="mb-3 text-xs text-ink-3">
                {COPY.managerDashboard.whereToFocusSub}
              </p>
              <div className="space-y-3">
                {lowPillars.map((p) => (
                  <RecommendationCard
                    key={p.pillarId}
                    pillarId={p.pillarId}
                    text={`${fill(COPY.managerDashboard.teamPillarAt, { pillar: PILLARS[p.pillarId].label, score: p.score!.toFixed(1) })} ${getSampleRecommendation(p.pillarId).text}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => router.push("/inbox")}
                className="mt-4 w-full rounded-2xl bg-brand py-3 font-display text-sm font-black text-white transition active:scale-[0.98]"
              >
                {COPY.managerDashboard.openActionInbox}
              </button>
            </Card>
          )}

          {/* Leadership wisdom — manager-audience learning path (Phase 3.4) */}
          <button
            type="button"
            onClick={() => router.push("/dashboard/manager/wisdom")}
            className="w-full rounded-card border border-lav-mid bg-white p-4 text-left shadow-card transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-lav-soft text-xl">
                🧭
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-black leading-tight text-ink">{COPY.managerDashboard.leadershipWisdomTitle}</p>
                <p className="mt-0.5 text-[11px] text-ink-3">
                  {COPY.managerDashboard.leadershipWisdomSub}
                </p>
              </div>
              <span className="flex-shrink-0 text-brand-light">→</span>
            </div>
          </button>

          {/* Trend — team vs org / dept / industry */}
          <TrendChart data={data.trend} window={window} onWindowChange={setWindow} />

          <p className="pb-2 text-center text-[11px] text-ink-4">
            {COPY.managerDashboard.footnote}
          </p>
        </>
      )}
    </ScreenShell>
  );
}
