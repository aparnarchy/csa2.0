"use client";

import { useState } from "react";
import { CatchUpFlow } from "./CatchUpFlow";
import { CheckInFlow } from "./CheckInFlow";
import type { CheckInQuestion } from "@/lib/data";
import type { SessionUser } from "@/lib/types";

/**
 * A check-in session in order: catch-up on missed weeks first (if any), then
 * this week's fresh questions.
 */
export function CheckInSession({
  session,
  unanswered,
  due,
}: {
  session: SessionUser;
  unanswered: CheckInQuestion[];
  due: CheckInQuestion[];
}) {
  const [phase, setPhase] = useState<"catchup" | "fresh">(unanswered.length ? "catchup" : "fresh");

  if (phase === "catchup") {
    return <CatchUpFlow session={session} questions={unanswered} onDone={() => setPhase("fresh")} />;
  }
  return <CheckInFlow session={session} questions={due} />;
}
