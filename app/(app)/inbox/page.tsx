export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getViewMode } from "@/lib/view-mode";
import { resolveView } from "@/lib/views";
import { getActionHistory, getFeedbackActions, getManagerInbox } from "@/lib/feedback";
import {
  getOpenRecommendations,
  getRecommendationHistory,
  getReflections,
  getUnansweredCheckIns,
} from "@/lib/checkins";
import { getEmployeeScores } from "@/lib/scores";
import { InboxView } from "./InboxView";
import { ManagerInboxView } from "../dashboard/manager/inbox/ManagerInboxView";

/**
 * Inbox (Phase 2.6): unanswered questions, recommendations, feedback actions.
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

  const viewingAsEmployee = resolveView(session.user, await getViewMode()) === "employee";
  if (session.user.roles.includes("manager") && !viewingAsEmployee) {
    const inbox = await getManagerInbox(session.user, "my-team");
    return <ManagerInboxView session={session.user} initial={inbox} />;
  }

  const [unanswered, actions, history, reflections, openRecs, recHistory] = await Promise.all([
    getUnansweredCheckIns(session.user, session.user.id),
    getFeedbackActions(session.user, session.user.id),
    getActionHistory(session.user, session.user.id),
    getReflections(session.user, session.user.id),
    getOpenRecommendations(session.user, session.user.id),
    getRecommendationHistory(session.user, session.user.id),
  ]);
  // Each recommendation card leads with the person's current pillar score.
  const scores = openRecs.length
    ? await getEmployeeScores(session.user, session.user.id).catch(() => null)
    : null;
  const pillarScores = Object.fromEntries((scores?.pillars ?? []).map((p) => [p.pillarId, p.score]));

  return (
    <InboxView
      session={session.user}
      unanswered={unanswered}
      actions={actions}
      history={history}
      reflections={reflections}
      openRecommendations={openRecs}
      pillarScores={pillarScores}
      recommendationHistory={recHistory}
    />
  );
}
