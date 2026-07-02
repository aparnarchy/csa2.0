export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getManagerInbox } from "@/lib/feedback";
import { ManagerInboxView } from "./ManagerInboxView";

/** Manager Action Inbox (Phase 3.3): the 4-week feedback-action loop. */
export default async function ManagerInboxPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("manager")) redirect("/dashboard");

  const inbox = await getManagerInbox(session.user, "my-team");

  return <ManagerInboxView session={session.user} initial={inbox} />;
}
