"use client";

import { useState } from "react";
import { CatchUpFlow } from "./CatchUpFlow";
import { CheckInFlow } from "./CheckInFlow";
import { ReturnCheckIn } from "./ReturnCheckIn";
import type { CheckInQuestion, OpenRecommendation } from "@/lib/data";
import type { SessionUser } from "@/lib/types";

type Phase = "catchup" | "followup" | "fresh";

/**
 * A check-in session, in order:
 *   1. catch-up on missed weeks (if any),
 *   2. follow up on the last unacted recommendation (if any),
 *   3. this week's fresh questions.
 * Each step is skipped when there's nothing for it.
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
  const firstPhase: Phase = unanswered.length ? "catchup" : openRec ? "followup" : "fresh";
  const [phase, setPhase] = useState<Phase>(firstPhase);

  if (phase === "catchup") {
    return (
      <CatchUpFlow
        session={session}
        questions={unanswered}
        onDone={() => setPhase(openRec ? "followup" : "fresh")}
      />
    );
  }
  if (phase === "followup" && openRec) {
    return <ReturnCheckIn session={session} rec={openRec} onDone={() => setPhase("fresh")} />;
  }
  return <CheckInFlow session={session} questions={due} />;
}
