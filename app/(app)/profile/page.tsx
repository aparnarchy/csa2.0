export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getDB } from "@/lib/db";
import { getViewMode } from "@/lib/view-mode";
import { resolveView } from "@/lib/views";
import { getProfileStats } from "@/lib/profile";
import { getOwnDetails } from "@/lib/profile-details";
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
  const view = resolveView(session.user, await getViewMode());
  // Own record only — the session user's id, never a parameter.
  const db = getDB();
  const [own, details] = await Promise.all([
    db
      .prepare("SELECT personalEmail FROM user WHERE id = ?")
      .bind(session.user.id)
      .first<{ personalEmail: string | null }>(),
    getOwnDetails(db, session.user.id),
  ]);

  // The CEO/HR (org-scoped) profile goes with the CEO/HR view, not just the role.
  const org = view === "ceo_hr"
    ? await Promise.all([getCeoDashboard(session.user, "org", "3M"), getOrgParticipation(session.user)])
    : null;

  return (
    <ProfileView
      session={session.user}
      stats={stats}
      view={view}
      orgScore={org ? org[0] : null}
      orgParticipation={org ? org[1] : null}
      personalEmail={own?.personalEmail ?? null}
      details={details}
    />
  );
}
