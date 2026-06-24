export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getProfileStats } from "@/lib/data";
import { ProfileView } from "./ProfileView";

/** Profile screen (Phase 2.7): user info, activity, badges, settings, sign out. */
export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");

  const stats = await getProfileStats(session.user, session.user.id);

  return <ProfileView session={session.user} stats={stats} />;
}
