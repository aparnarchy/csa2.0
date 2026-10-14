"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot, RecommendationStack } from "@/components/kit";
import { questionTitle } from "@/lib/question-titles";
import { COPY, fill } from "@/lib/copy";
import { CatchUpFlow } from "./CatchUpFlow";
import { CheckInFlow } from "./CheckInFlow";
import { ReturnCheckIn } from "./ReturnCheckIn";
import type { CheckInQuestion, OpenRecommendation } from "@/lib/data";
import type { PillarId, SessionUser } from "@/lib/types";

const t = COPY.checkin;

type Phase = "followup" | "fresh" | "catchup" | "done";

/**
 * A check-in session, in order:
 *   1. this week's fresh questions (full-screen, auto-advancing),
 *   2. catch-up on earlier weeks (a distinct carousel) — never for first-timers,
 *      only when there are unanswered questions from previous weeks,
 *   3. return check-in — did you act on your last recommendation? — never for
 *      first-timers, only when there's an open low-score recommendation,
 *   4. a short "done" screen → the dashboard — skipped entirely when every
 *      answer this session was 7 or above: straight to the (refreshed)
 *      dashboard, no message (owner, 2026-10-14).
 * Each step is skipped when there's nothing for it, so a first-time user (or
 * anyone with no backlog and no open recommendation) goes straight from this
 * week's questions to the dashboard.
 */
export function CheckInSession({
  session,
  unanswered,
  openRec,
  due,
  pillarScores = {},
}: {
  session: SessionUser;
  unanswered: CheckInQuestion[];
  openRec: OpenRecommendation | null;
  due: CheckInQuestion[];
  /** The person's current score per pillar (shown on recommendation cards). */
  pillarScores?: Partial<Record<PillarId, number | null>>;
}) {
  const router = useRouter();
  const initial: Phase = due.length
    ? "fresh"
    : unanswered.length
      ? "catchup"
      : openRec
        ? "followup"
        : "done";
  const [phase, setPhase] = useState<Phase>(initial);
  // Answers below 7 this session (fresh + catch-up). None → straight to the
  // dashboard; some with recommendations → end on the recommendation cards.
  const [lows, setLows] = useState<CheckInQuestion[]>([]);
  const hadLow = lows.length > 0;
  const addLows = (l: CheckInQuestion[]) => {
    if (l.length) setLows((prev) => [...prev.filter((p) => !l.some((x) => x.assignmentId === p.assignmentId)), ...l]);
  };
  const didAnything = due.length > 0 || unanswered.length > 0;
  const skipDone = phase === "done" && didAnything && !hadLow;

  useEffect(() => {
    if (!skipDone) return;
    router.replace("/dashboard/employee");
    router.refresh(); // fresh scores, not a cached dashboard
  }, [skipDone, router]);

  if (phase === "fresh" && due.length) {
    return (
      <CheckInFlow
        session={session}
        questions={due}
        onDone={(l) => {
          addLows(l);
          setPhase(unanswered.length ? "catchup" : openRec ? "followup" : "done");
        }}
      />
    );
  }
  if (phase === "catchup" && unanswered.length) {
    return (
      <CatchUpFlow
        questions={unanswered}
        onDone={(l) => {
          addLows(l);
          setPhase(openRec ? "followup" : "done");
        }}
      />
    );
  }
  if (phase === "followup" && openRec) {
    return (
      <ReturnCheckIn
        rec={openRec}
        // The "Yes, I acted on it" path already showed its own celebration
        // screen — go straight to the dashboard instead of also showing this
        // session's "done" screen. "Not yet" never celebrated, so it still
        // needs one.
        onDone={(alreadyCelebrated) =>
          alreadyCelebrated ? router.push("/dashboard/employee") : setPhase("done")
        }
      />
    );
  }

  // Done — a short confirmation (reached automatically after the last answer),
  // then the dashboard. A back arrow returns to the previous step if the user
  // wants to change an answer.
  // All answers 7+: leave for the dashboard (effect above), showing nothing.
  if (skipDone) return <div className="min-h-[100dvh] bg-lav-bg" />;

  const first = (session.name || "there").trim().split(/\s+/)[0];

  // Low answers with a recommendation: end on the card stack — one card in
  // front at a time, never a bundle (owner, 2026-10-14). Newest first.
  const recs = lows.filter((q) => q.recommendation).reverse();
  if (recs.length > 0) {
    return (
      <div className="screen-enter mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center gap-4 bg-lav-bg px-5 py-8">
        <div className="text-center">
          <h1 className="font-display text-2xl font-black text-brand">{fill(t.doneNiceWorkTitle, { name: first })}</h1>
          <p className="mt-1 text-sm text-ink-2">{t.doneLoggedBody}</p>
        </div>
        <RecommendationStack
          userKey={session.id}
          heading={recs.length === 1 ? "A recommendation for you" : "Recommendations for you"}
          items={recs.map((q) => ({
            id: q.id,
            title: questionTitle(q.id, q.text),
            score: pillarScores[q.pillarId] ?? null,
            text: q.recommendation,
          }))}
        />
        <button
          type="button"
          onClick={() => router.push("/dashboard/employee")}
          className="w-full rounded-2xl bg-brand py-3.5 font-display text-sm font-black text-white active:scale-[0.98]"
        >
          {t.seeDashboardButton}
        </button>
        <p className="text-center text-[11px] text-ink-4">They stay in your Inbox too.</p>
      </div>
    );
  }
  const prevPhase: Phase | null = openRec
    ? "followup"
    : unanswered.length
      ? "catchup"
      : due.length
        ? "fresh"
        : null;

  return (
    <div className="screen-enter relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center gap-5 bg-lav-bg px-8 text-center">
      {prevPhase && (
        <button
          type="button"
          onClick={() => setPhase(prevPhase)}
          aria-label="Back"
          className="absolute left-4 top-5 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-ink-4 transition active:scale-90"
        >
          ‹
        </button>
      )}
      <Mascot state="happy" size={150} />
      <div>
        <h1 className="font-display text-2xl font-black text-brand">
          {didAnything ? fill(t.doneNiceWorkTitle, { name: first }) : t.doneAllCaughtUpTitle}
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          {didAnything ? t.doneLoggedBody : t.doneAllCaughtUpBody}
        </p>
      </div>
      <button
        type="button"
        onClick={() => router.push("/dashboard/employee")}
        className="w-full rounded-2xl bg-brand py-3.5 font-display text-sm font-black text-white active:scale-[0.98]"
      >
        {t.seeDashboardButton}
      </button>
    </div>
  );
}
