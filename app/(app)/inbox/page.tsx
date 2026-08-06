export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getActionHistory, getFeedbackActions, getManagerInbox } from "@/lib/feedback";
import {
  getLatestCheckIn,
  getOpenRecommendations,
  getRecommendationHistory,
  getReflections,
  getUnansweredCheckIns,
} from "@/lib/checkins";
import { InboxView } from "./InboxView";
import { ManagerInboxView } from "../dashboard/manager/inbox/ManagerInboxView";

/**
 * Inbox (Phase 2.6): latest check-in, unanswered questions, feedback actions.
 *
 * A manager's "Inbox" bottom-nav tab means their Action Inbox (the 4-week
 * feedback-action loop) — it was previously only reachable via a button on the
 * manager dashboard, while the tab itself silently fell through to this
 * employee-shaped screen. Branching here, not adding a second tab, is what
 * makes it actually "part of the Inbox screen" per the owner's ask.
 */
export default async function InboxPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");

  if (session.user.roles.includes("manager")) {
    const inbox = await getManagerInbox(session.user, "my-team");
    return <ManagerInboxView session={session.user} initial={inbox} />;
  }

  const [latest, unanswered, actions, history, reflections, openRecs, recHistory] = await Promise.all([
    getLatestCheckIn(session.user, session.user.id),
    getUnansweredCheckIns(session.user, session.user.id),
    getFeedbackActions(session.user, session.user.id),
    getActionHistory(session.user, session.user.id),
    getReflections(session.user, session.user.id),
    getOpenRecommendations(session.user, session.user.id),
    getRecommendationHistory(session.user, session.user.id),
  ]);

  return (
    <InboxView
      session={session.user}
      latest={latest}
      unanswered={unanswered}
      actions={actions}
      history={history}
      reflections={reflections}
      openRecommendations={openRecs}
      recommendationHistory={recHistory}
    />
  );
}
