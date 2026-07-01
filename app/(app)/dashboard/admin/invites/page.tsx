export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getInvites, getOrgStructure } from "@/lib/admin";
import { InvitesView } from "./InvitesView";

/** Admin → Invites (Phase 4.4). Admin role only. */
export default async function InvitesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("admin")) redirect("/dashboard");

  const [invites, org] = await Promise.all([
    getInvites(session.user),
    getOrgStructure(session.user),
  ]);

  return <InvitesView session={session.user} initial={invites} teams={org.teams} />;
}
