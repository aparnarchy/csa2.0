"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AIInsight,
  BigScore,
  Card,
  GradientHeader,
  InsightBarRow,
  Mascot,
  NotEnoughData,
  PillarCard,
  RecommendationCard,
  ScoreCircles,
  ScreenShell,
  SegmentedToggle,
  TrendChart,
} from "@/components/kit";
import { getSampleRecommendation, type TeamAggregate, type Window } from "@/lib/data";
import { COPY, fill } from "@/lib/copy";
import { getTeamAggregateAction, getTeamInsightAction } from "./actions";
import { HEADER_MASCOT_SIZE, mascotForScore } from "@/lib/mascot";
import { PILLARS, STRENGTH_CUTOFF } from "@/lib/pillars";
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
  const [scTab, setScTab] = useState<"strengths" | "concerns">("strengths");
  const [scOpenId, setScOpenId] = useState<string | null>(null);

  // Time filter recomputes the whole aggregate via a server action (real D1,
  // privacy-enforced). The team is resolved server-side to the signed-in manager.
  useEffect(() => {
    getTeamAggregateAction(window).then(setData);
    getTeamInsightAction(window).then(setAiText);
  }, [window]);

  const isPlay = session.themeMode === "play";
  const firstName = (session.name || "there").trim().split(/\s+/)[0];
  const up = (data.delta ?? 0) >= 0;

  // Participation is a data-VALIDITY signal, not a performance number — how
  // much to trust the scores above, never an individual's response. Clearing
  // the anonymisation floor (enforced server-side) only means there's enough
  // to show at all; this tiers how solid that "enough" actually is.
  const confidence =
    data.participation >= 80
      ? { label: COPY.managerDashboard.confidenceStrong, color: "#059669", bg: "#E8FBF0" }
      : data.participation >= 50
        ? { label: COPY.managerDashboard.confidenceModerate, color: "#B45309", bg: "#FEF3C7" }
        : { label: COPY.managerDashboard.confidenceLimited, color: "#DC2626", bg: "#FDECEC" };

  // Pillars below 7 (and above the floor) get a recommendation, weakest first.
  const lowPillars = data.pillars
    .filter((p) => p.score !== null && p.score < 7)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

  // The real recommendation for each low pillar's weakest question (admin-
  // authored if one's been written, same generic pillar fallback otherwise —
  // getSampleRecommendation is that fallback's own source, not a mock we're
  // bypassing the real data for).
  const recommendationFor = (pid: PillarId): string => {
    const qs = data.questions.filter((q) => q.pillarId === pid);
    const weakest = qs.length ? [...qs].sort((a, b) => a.score - b.score)[0] : null;
    return weakest?.recommendation ?? getSampleRecommendation(pid).text;
  };

  // Team-level Bright Spot / Watch Out — same pattern as the employee dashboard,
  // just computed from the team's pillar averages instead of one person's.
  const scoredPillars = data.pillars.filter((p) => p.score !== null);
  const brightPillar = scoredPillars.length
    ? [...scoredPillars].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
    : null;
  const watchPillar = scoredPillars.length
    ? [...scoredPillars].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]
    : null;

  // Strengths & Concerns — same question-level shape as every other
  // dashboard (real per-question team scores, anonymised in getTeamAggregate:
  // a question only appears once >= the anonymisation floor of distinct
  // teammates answered it).
  const scSorted = [...data.questions].sort((a, b) => b.score - a.score);
  const scStrengths = scSorted.filter((q) => q.score >= STRENGTH_CUTOFF).slice(0, 3);
  const scConcerns = scSorted.filter((q) => q.score < STRENGTH_CUTOFF).reverse().slice(0, 3);
  const scShown = scTab === "strengths" ? scStrengths : scConcerns;

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

          {/* Team score + delta, then participation as its own full-width row
              so the confidence indicator always has room to lay out on one
              line instead of cramming into the narrow column beside the
              score and wrapping. */}
          <Card>
            <div className="flex items-start justify-between">
              <BigScore score={data.teamScore} />
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

            {/* Data-confidence + participation — its own row with full card
                width, so it never has to squeeze into the column beside the
                score. A dot instead of a pill avoids the label ever wrapping
                mid-word. */}
            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-lav-mid pt-3">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold" style={{ color: confidence.color }}>
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: confidence.color }} />
                {confidence.label}
              </span>
              <span className="text-xs text-ink-3">·</span>
              <span className="whitespace-nowrap text-xs text-ink-3">
                {fill(COPY.managerDashboard.peopleParticipation, { count: data.reporteeCount, pct: data.participation })}
              </span>
            </div>

            {/* Pillar cards — aggregates only, no drill into individuals. Tap
                through to the team-level pillar detail (same shape as the
                employee dashboard's). Pillars with no data yet aren't clickable. */}
            <div className="-mx-1.5 mt-4 grid grid-cols-4 gap-2">
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
                    text={`${fill(COPY.managerDashboard.teamPillarAt, { pillar: PILLARS[p.pillarId].label, score: p.score!.toFixed(1) })} ${recommendationFor(p.pillarId)}`}
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

          {/* Strengths & Concerns — before Trend, same shape as every other
              dashboard (SegmentedToggle + InsightBarRow over real questions). */}
          <Card>
            <p className="mb-3 text-sm font-bold text-brand">Insights</p>
            <div className="mb-4">
              <SegmentedToggle
                value={scTab}
                onChange={(v) => {
                  setScTab(v);
                  setScOpenId(null);
                }}
                options={[
                  { value: "strengths", label: "💪 Strengths" },
                  { value: "concerns", label: "⚠️ Concerns" },
                ]}
              />
            </div>
            {scShown.map((q) => (
              <InsightBarRow
                key={q.id}
                q={q}
                isStrength={scTab === "strengths"}
                open={scOpenId === q.id}
                onToggle={() => setScOpenId((cur) => (cur === q.id ? null : q.id))}
              />
            ))}
            {scShown.length === 0 && (
              <p className="text-xs text-ink-4">
                {scTab === "strengths" ? "Nothing scoring 7+ yet." : "Nothing scoring below 7 — nice."}
              </p>
            )}
          </Card>

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
