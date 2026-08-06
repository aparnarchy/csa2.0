"use client";

import { useState } from "react";
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
 *   1. return check-in — did you act on your last recommendation? (if any),
 *   2. this week's fresh questions (full-screen, auto-advancing),
 *   3. catch-up on earlier weeks (a distinct carousel, if any),
 *   4. a short "done" screen → the dashboard.
 * Each step is skipped when there's nothing for it, so an empty session lands
 * straight on the done screen.
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
  const initial: Phase = openRec ? "followup" : due.length ? "fresh" : unanswered.length ? "catchup" : "done";
  const [phase, setPhase] = useState<Phase>(initial);

  if (phase === "followup" && openRec) {
    return (
      <ReturnCheckIn
        rec={openRec}
        onDone={() => setPhase(due.length ? "fresh" : unanswered.length ? "catchup" : "done")}
      />
    );
  }
  if (phase === "fresh" && due.length) {
    return (
      <CheckInFlow
        session={session}
        questions={due}
        onDone={() => setPhase(unanswered.length ? "catchup" : "done")}
      />
    );
  }
  if (phase === "catchup" && unanswered.length) {
    return <CatchUpFlow questions={unanswered} onDone={() => setPhase("done")} />;
  }

  // Done — a short confirmation, then the dashboard.
  const first = (session.name || "there").trim().split(/\s+/)[0];
  const didAnything = due.length > 0 || unanswered.length > 0;
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center gap-5 bg-lav-bg px-8 text-center">
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
