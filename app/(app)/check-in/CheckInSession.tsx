"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/kit";
import { COPY, fill } from "@/lib/copy";
import { CatchUpFlow } from "./CatchUpFlow";
import { CheckInFlow } from "./CheckInFlow";
import { ReturnCheckIn } from "./ReturnCheckIn";
import type { CheckInQuestion, OpenRecommendation } from "@/lib/data";
import type { SessionUser } from "@/lib/types";

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
}: {
  session: SessionUser;
  unanswered: CheckInQuestion[];
  openRec: OpenRecommendation | null;
  due: CheckInQuestion[];
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
  // Any answer below 7 this session (fresh or catch-up)? Decides whether the
  // session ends on the "done" screen or goes straight to the dashboard.
  const [hadLow, setHadLow] = useState(false);
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
        onDone={(anyLow) => {
          if (anyLow) setHadLow(true);
          setPhase(unanswered.length ? "catchup" : openRec ? "followup" : "done");
        }}
      />
    );
  }
  if (phase === "catchup" && unanswered.length) {
    return (
      <CatchUpFlow
        questions={unanswered}
        onDone={(anyLow) => {
          if (anyLow) setHadLow(true);
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
