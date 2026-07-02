export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getActionHistory, getFeedbackActions } from "@/lib/data";
import { getLatestCheckIn, getUnansweredCheckIns } from "@/lib/checkins";
import { InboxView } from "./InboxView";

/** Inbox (Phase 2.6): latest check-in, unanswered questions, feedback actions. */
export default async function InboxPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");

  const [latest, unanswered, actions, history] = await Promise.all([
    getLatestCheckIn(session.user, session.user.id),
    getUnansweredCheckIns(session.user, session.user.id),
    getFeedbackActions(session.user, session.user.id),
    getActionHistory(session.user, session.user.id),
  ]);

  return (
    <InboxView
      session={session.user}
      latest={latest}
      unanswered={unanswered}
      actions={actions}
      history={history}
    />
  );
}
