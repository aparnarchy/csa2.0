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
  ScoreCircles,
  ScreenShell,
  SegmentedToggle,
  TrendChart,
} from "@/components/kit";
import { type EmployeeScores, type Window } from "@/lib/data";
import { getEmployeeInsightAction, getEmployeeScoresAction } from "./actions";
import { HEADER_MASCOT_SIZE, mascotForScore } from "@/lib/mascot";
import { PILLARS, STRENGTH_CUTOFF } from "@/lib/pillars";
import { COPY, fill } from "@/lib/copy";
import { buildEmployeeInsight, type InsightSpot } from "@/lib/insight";
import { earlyReadNote } from "@/lib/mood";
import { chromeFor } from "@/lib/voice";
import type { EmployeeInsightCard } from "@/lib/insight-signals";
import type { PillarId, SessionUser } from "@/lib/types";
import { PillarDetailView } from "./PillarDetailView";
import { keepCurrent, withRetry } from "@/lib/retry";

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
  /** undefined = still being worked out; null = none available. */
  const [aiCard, setAiCard] = useState<EmployeeInsightCard | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("strengths");
  const [selectedPillar, setSelectedPillar] = useState<PillarId | null>(null);
  /** Accordion: at most one question row is expanded at a time. */
  const [openId, setOpenId] = useState<string | null>(null);
  /** Strengths / Concerns show their top 3 until "See all" is tapped. */
  const [showAll, setShowAll] = useState(false);

  // Time filter refreshes score + pillars + chart together via a server action
  // (real aggregation over the user's own check-ins).
  useEffect(() => {
    withRetry(() => getEmployeeScoresAction(window)).then(setData, keepCurrent);
    setAiCard(undefined);
    withRetry(() => getEmployeeInsightAction(window)).then(setAiCard, () => setAiCard(null));
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

  // Fewer than 3 answers ever: no dashboard yet — just the mascot in the
  // middle of the screen saying what will unlock it (owner, 2026-10-09).
  if (data.totalAnswers < WAITING_UNTIL) {
    return (
      <ScreenShell active="insights">
        <WaitingScreen answers={data.totalAnswers} />
      </ScreenShell>
    );
  }

  const sortedQs = [...data.questions].sort((a, b) => b.score - a.score);
  const allStrengths = sortedQs.filter((q) => q.score > STRENGTH_CUTOFF);
  const allConcerns = sortedQs.filter((q) => q.score <= STRENGTH_CUTOFF).reverse();
  // A tab with nothing in it isn't shown at all (no empty "Concerns" tab when
  // everything is a strength), so the toggle only appears when both have rows.
  const bothTabs = allStrengths.length > 0 && allConcerns.length > 0;
  const activeTab: Tab = bothTabs ? tab : allStrengths.length > 0 ? "strengths" : "concerns";
  const tabQs = activeTab === "strengths" ? allStrengths : allConcerns;
  const shownQs = showAll ? tabQs : tabQs.slice(0, 3);
  const up = (data.delta ?? 0) >= 0;
  // Mode = design only. Play shows the fun look (mascot, blob circles, persona
  // voice); Professional is a plain, serious dashboard with neutral copy.
  const isPlay = session.themeMode === "play";
  const persona = isPlay ? session.persona : undefined;
  const insight = buildEmployeeInsight(data, persona);
  const chrome = chromeFor(persona);
  const firstName = (session.name || "there").trim().split(/\s+/)[0];
  // The pillars not shown as a big circle — the small bubbles under them.
  const otherPillars = data.pillars
    .filter((p) => p.pillarId !== insight.brightSpot?.pillarId && p.pillarId !== insight.watchOut?.pillarId)
    .map((p) => ({ pillarId: p.pillarId, pillar: PILLARS[p.pillarId].label, score: p.score }));

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
          <p className="mt-3 font-display text-lg font-black leading-tight text-brand">
            {insight.headline}.
          </p>
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
          <p className="mt-2 font-display text-base font-black leading-snug text-brand-light">
            {insight.headline}.
          </p>
        </div>
      )}
      {/* 1. The AI insight — "here's what I noticed", never advice. */}
      {aiCard === undefined ? (
        <AIInsight loading eyebrow={fill(COPY.insight.eyebrowHappening, { name: firstName })} />
      ) : aiCard ? (
        <AIInsight text={aiCard.text} eyebrow={aiCard.eyebrow} foot={aiCard.foot} footHref={aiCard.footHref} />
      ) : (
        <AIInsight />
      )}

      {/* 2. Overall happiness — the first number people see, slim. */}
      {data.overall !== null && (
        <Card>
          <BigScore
            inline
            score={data.overall}
            trailing={
              data.delta !== null ? (
                <div className="inline-flex items-center gap-1 rounded-full bg-lav-soft px-2.5 py-1 text-xs font-bold text-brand">
                  {up ? "↑" : "↓"} {Math.abs(data.delta).toFixed(1)}
                  <span className="text-[10px] font-medium text-ink-3">vs last</span>
                </div>
              ) : undefined
            }
          />
          {earlyReadNote(data.responseCount) && (
            <p className="mt-2 text-[11px] text-ink-4">{earlyReadNote(data.responseCount)}</p>
          )}
        </Card>
      )}

      {/* 3. Your pillars — all four together, apart from the score so nobody
          reads the score as an average of some of them. The earned circles
          (Bright spot above 7, Watch out at 7 or below; lib/insight.ts) are
          the big ones; the rest are small bubbles tucked under them. Play:
          wavy blobs. Professional: plain stat cards, bubbles beneath. */}
      <section>
        <p className="mb-2 text-center font-display text-sm font-black uppercase tracking-wide text-brand">
          {COPY.mood.pillarsTitle}
        </p>
        {isPlay ? (
          <div className="mb-2 pt-1">
            <ScoreCircles
              bright={insight.brightSpot}
              watch={insight.watchOut}
              others={otherPillars}
              onSelect={setSelectedPillar}
            />
          </div>
        ) : (
          <>
            {(insight.brightSpot || insight.watchOut) && (
              <div className={`mb-3 grid gap-2 ${insight.brightSpot && insight.watchOut ? "grid-cols-2" : "grid-cols-1"}`}>
                {insight.brightSpot && (
                  <SpotCard title={COPY.mood.brightSpot} spot={insight.brightSpot} onSelect={setSelectedPillar} />
                )}
                {insight.watchOut && (
                  <SpotCard title={COPY.mood.watchOut} spot={insight.watchOut} onSelect={setSelectedPillar} />
                )}
              </div>
            )}
            <ScoreCircles bright={null} watch={null} others={otherPillars} onSelect={setSelectedPillar} />
          </>
        )}
      </section>

      {/* 5. Strengths / Concerns — top 3, "See all" for the rest. */}
      {tabQs.length > 0 && (
        <Card>
          {bothTabs ? (
            <div className="mb-4">
              <SegmentedToggle
                value={activeTab}
                onChange={(v) => {
                  setTab(v);
                  setOpenId(null);
                  setShowAll(false);
                }}
                options={[
                  { value: "strengths", label: "Strengths" },
                  { value: "concerns", label: "Concerns" },
                ]}
              />
            </div>
          ) : (
            <p className="mb-3 text-sm font-bold text-brand">
              {activeTab === "strengths" ? "Strengths" : "Concerns"}
            </p>
          )}
          {shownQs.map((q) => (
            <InsightBarRow
              key={q.id}
              q={q}
              isStrength={activeTab === "strengths"}
              open={openId === q.id}
              onToggle={() => setOpenId((cur) => (cur === q.id ? null : q.id))}
            />
          ))}
          {tabQs.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-1 text-xs font-bold text-brand active:opacity-70"
            >
              {showAll ? COPY.mood.showFewer : fill(COPY.mood.seeAll, { count: tabQs.length })}
            </button>
          )}
        </Card>
      )}

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
    </ScreenShell>
  );
}

/** The dashboard opens once someone has given this many answers in total. */
const WAITING_UNTIL = 3;

/** Before the dashboard opens: the mascot in the middle of the screen with
 *  one big line, and nothing else. */
function WaitingScreen({ answers }: { answers: number }) {
  const left = WAITING_UNTIL - answers;
  const title =
    answers === 0
      ? COPY.mood.waitingTitle
      : fill(COPY.mood.unlockTitle, { count: `${left} more ${left === 1 ? "answer" : "answers"}` });
  return (
    <div className="flex min-h-[62vh] flex-col items-center justify-center px-6 text-center">
      <Mascot state="welcome" size={HEADER_MASCOT_SIZE} />
      <h1 className="mt-6 font-display text-[26px] font-black leading-tight text-brand [text-wrap:balance]">
        {title}
      </h1>
      <p className="mt-2 text-sm text-ink-3">{answers === 0 ? COPY.mood.waitingSub : COPY.mood.unlockSub}</p>
    </div>
  );
}

/** Professional-mode Bright spot / Watch out card (only ever an earned one). */
function SpotCard({
  title,
  spot,
  onSelect,
}: {
  title: string;
  spot: InsightSpot;
  onSelect: (pillarId: PillarId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(spot.pillarId)}
      className="rounded-card bg-lav-soft p-4 text-left shadow-card transition active:scale-[0.98]"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">{title}</p>
      <p className="mt-1 font-display text-3xl font-black leading-none text-brand">{spot.score.toFixed(1)}</p>
      <p className="mt-1 text-xs text-brand/70">{spot.pillar}</p>
    </button>
  );
}
