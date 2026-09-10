export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getViewMode } from "@/lib/view-mode";
import { getProfileStats } from "@/lib/profile";
import { getCeoDashboard, getOrgParticipation } from "@/lib/ceo";
import { ProfileView } from "./ProfileView";

/** Profile screen (Phase 2.7): user info, activity, badges, settings, sign out.
 *  CEO/HR gets a distinct, org-scoped version regardless of whether they also
 *  happen to have their own employment — see ProfileView. */
export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");

  const stats = await getProfileStats(session.user, session.user.id);
  const viewMode = (await getViewMode()) ?? "manager";

  const isCeoHr = session.user.roles.includes("ceo_hr");
  const org = isCeoHr
    ? await Promise.all([getCeoDashboard(session.user, "org", "3M"), getOrgParticipation(session.user)])
    : null;

  return (
    <ProfileView
      session={session.user}
      stats={stats}
      viewingAsEmployee={viewMode === "employee"}
      orgScore={org ? org[0] : null}
      orgParticipation={org ? org[1] : null}
    />
  );
}
