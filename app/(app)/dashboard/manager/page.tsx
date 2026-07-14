export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getTeamAggregate } from "@/lib/team";
import { getTeamInsight } from "@/lib/ai";
import { ManagerDashboardView } from "./ManagerDashboardView";

/** Manager dashboard (Phase 3.2): anonymous team aggregates only. */
export default async function ManagerDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("manager")) redirect("/dashboard");

  const team = await getTeamAggregate(session.user, "my-team", "3M");
  const insight = await getTeamInsight(session.user.id, "3M", team);

  return <ManagerDashboardView session={session.user} initial={team} initialInsight={insight} />;
}
