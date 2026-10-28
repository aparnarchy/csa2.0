"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AIInsight,
  BigScore,
  Card,
  EmptyScoreCard,
  GradientHeader,
  InsightBarRow,
  LeaverNote,
  Mascot,
  PillarInfo,
  RecommendationStack,
  ScoreCircles,
  ScreenShell,
  SpotCard,
  SegmentedToggle,
  TrendChart,
  WINS_LABEL,
  WORRIES_LABEL,
  ShowMoreButton,
  visibleRows,
} from "@/components/kit";
import type { TeamAggregate, Window } from "@/lib/data";
import { COPY, fill } from "@/lib/copy";
import { getTeamAggregateAction, getTeamInsightAction } from "./actions";
import { HEADER_MASCOT_SIZE, mascotForScore } from "@/lib/mascot";
import { PILLARS, STRENGTH_CUTOFF } from "@/lib/pillars";
import { buildInsight } from "@/lib/insight";
import { ANONYMISATION_FLOOR } from "@/lib/scoring";
import type { PillarId, SessionUser } from "@/lib/types";
import { TeamPillarDetailView } from "./TeamPillarDetailView";
import { keepCurrent, withRetry } from "@/lib/retry";

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
  const [scShowAll, setScShowAll] = useState(false);
  // undefined = nothing chosen yet → the first row starts open.
  const [scOpenId, setScOpenId] = useState<string | null | undefined>(undefined);

  // Time filter recomputes the whole aggregate via a server action (real D1,
  // privacy-enforced). The team is resolved server-side to the signed-in manager.
  useEffect(() => {
    withRetry(() => getTeamAggregateAction(window)).then(setData, keepCurrent);
    withRetry(() => getTeamInsightAction(window)).then(setAiText, keepCurrent);
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

  // The admin-written recommendation for each low pillar's weakest question,
  // or "" when none has been written (no generic stand-in — owner, 2026-10-14).
  const recommendationFor = (pid: PillarId): string => {
    const qs = data.questions.filter((q) => q.pillarId === pid);
    const weakest = qs.length ? [...qs].sort((a, b) => a.score - b.score)[0] : null;
    return weakest?.recommendation ?? "";
  };

  const focusRecs = lowPillars.filter((p) => recommendationFor(p.pillarId));
  const focusNoRec = lowPillars.filter((p) => !recommendationFor(p.pillarId));

  // Team-level highest / lowest pillar — same rules as the employee dashboard
  // (lib/insight.ts), so a low team pillar is never labelled a bright spot.
  const { brightSpot: brightPillar, watchOut: watchPillar } = buildInsight(
    data.enoughData ? data.teamScore : null,
    data.delta,
    data.pillars,
  );

  // The pillars not shown as a circle / spot tile — the pills under them.
  const otherPillars = data.pillars
    .filter((p) => p.pillarId !== brightPillar?.pillarId && p.pillarId !== watchPillar?.pillarId)
    .map((p) => ({ pillarId: p.pillarId, pillar: PILLARS[p.pillarId].label, score: p.score }));

  // Strengths & Concerns — same question-level shape as every other
  // dashboard (real per-question team scores, anonymised in getTeamAggregate:
  // a question only appears once >= the anonymisation floor of distinct
  // teammates answered it).
  const scSorted = [...data.questions].sort((a, b) => b.score - a.score);
  const scStrengths = scSorted.filter((q) => q.score > STRENGTH_CUTOFF);
  const scConcerns = scSorted.filter((q) => q.score <= STRENGTH_CUTOFF).reverse();
  const scShownAll = scTab === "strengths" ? scStrengths : scConcerns;
  const scShown = visibleRows(scShownAll, scShowAll);

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
          compact
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
        >
          {/* Kept small so the privacy note doesn't dominate (owner, 2026-10-21). */}
          <p className="mt-1 text-[11px] font-semibold text-ink-3">
            {COPY.managerDashboard.anonNote}
          </p>
        </GradientHeader>
      ) : (
        <div
          className="rounded-card px-5 py-4"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <p className="text-xs font-semibold text-brand/70">{COPY.managerDashboard.eyebrow}</p>
          <h1 className="mt-1 font-display text-[24px] font-black leading-tight text-brand">
            {fill(COPY.managerDashboard.teamTitle, { name: firstName })}
          </h1>
          <p className="mt-1 text-[11px] font-semibold text-ink-3">
            {COPY.managerDashboard.anonNote}
          </p>
        </div>
      )}

      {!data.enoughData || data.teamScore === null ? (
        // Starting state: 0.0 in grey plus exactly what's missing (who needs
        // to join / check in) — no mood, no spots, until there's real data.
        <EmptyScoreCard message={data.reason ?? fill(COPY.mood.noDataTeam, { floor: ANONYMISATION_FLOOR })} />
      ) : (
        <>
          {/* Same layout as the employee dashboard (owner, 2026-10-28): AI
              insight, the overall score, then the pillars — circles (Play) or
              spot tiles (Professional) with the other pillars as pills in one
              row. Team-level, aggregates only. */}
          <AIInsight text={aiText ?? undefined} />

          {/* Team score + delta, then data confidence + participation on its
              own full-width row so it never squeezes beside the score. */}
          <Card>
            <BigScore
              inline
              score={data.teamScore}
              trailing={
                data.delta !== null ? (
                  <div className="inline-flex items-center gap-1 rounded-full bg-lav-soft px-2.5 py-1 text-xs font-bold text-brand">
                    {up ? "↑" : "↓"} {Math.abs(data.delta).toFixed(1)}
                    <span className="text-[10px] font-medium text-ink-3">{COPY.managerDashboard.vsLast}</span>
                  </div>
                ) : undefined
              }
            />
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
            <LeaverNote count={data.leaverCount} />
          </Card>

          {/* Team pillars — tap through to the team-level pillar detail. */}
          <section>
            <p className="mb-2 text-center font-display text-sm font-black uppercase tracking-wide text-brand">
              {COPY.managerDashboard.pillarsTitle}
            </p>
            {isPlay ? (
              <div className="mb-2 pt-1">
                <ScoreCircles bright={brightPillar} watch={watchPillar} others={otherPillars} onSelect={setSelectedPillar} />
              </div>
            ) : (
              <>
                {(brightPillar || watchPillar) && (
                  <div className={`mb-3 grid gap-2 ${brightPillar && watchPillar ? "grid-cols-2" : "grid-cols-1"}`}>
                    {brightPillar && <SpotCard title={COPY.mood.brightSpot} spot={brightPillar} onSelect={setSelectedPillar} />}
                    {watchPillar && <SpotCard title={COPY.mood.watchOut} spot={watchPillar} onSelect={setSelectedPillar} />}
                  </div>
                )}
                <ScoreCircles bright={null} watch={null} others={otherPillars} onSelect={setSelectedPillar} />
              </>
            )}
            <PillarInfo className="mt-3" />
          </section>

          {/* Recommendations — one per low pillar, weakest first */}
          {lowPillars.length > 0 && (
            <Card>
              <p className="mb-1 text-sm font-bold text-brand">{COPY.managerDashboard.whereToFocus}</p>
              <p className="mb-3 text-xs text-ink-3">
                {COPY.managerDashboard.whereToFocusSub}
              </p>
              {/* Pillars with a written recommendation: one card at a time,
                  tap or swipe for the next (owner, 2026-10-21 — no wall of
                  text). Pillars without one yet: just the name and score. */}
              {focusRecs.length > 0 && (
                <RecommendationStack
                  userKey={`${session.id}:team`}
                  heading="Recommendations"
                  countsForInbox={false}
                  items={focusRecs.map((p) => ({
                    id: p.pillarId,
                    title: PILLARS[p.pillarId].label,
                    score: p.score,
                    text: recommendationFor(p.pillarId),
                  }))}
                />
              )}
              {focusNoRec.length > 0 && (
                <div className={`space-y-2 ${focusRecs.length > 0 ? "mt-4" : ""}`}>
                  {focusNoRec.map((p) => (
                    <div
                      key={p.pillarId}
                      className="flex items-center justify-between rounded-card bg-lav-soft px-4 py-3"
                    >
                      <span className="text-sm font-bold text-ink">{PILLARS[p.pillarId].label}</span>
                      <span className="font-display text-base font-black text-brand">{p.score!.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
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

          {/* Trend — hidden until the team has 3 months of answers */}
          {data.trendReady && <TrendChart data={data.trend} window={window} onWindowChange={setWindow} />}

          <p className="pb-2 text-center text-[11px] text-ink-4">
            {COPY.managerDashboard.footnote}
          </p>
        </>
      )}
    </ScreenShell>
  );
}
