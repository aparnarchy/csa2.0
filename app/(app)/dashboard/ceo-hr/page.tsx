export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getCeoDashboard, getDepartmentScores } from "@/lib/ceo";
import { OrgDashboardView } from "./OrgDashboardView";

/** CEO / HR org dashboard — overall happiness + one panel per department. */
export default async function CeoHrPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("ceo_hr")) redirect("/dashboard");

  const [org, depts] = await Promise.all([
    getCeoDashboard(session.user, "org", "3M"),
    getDepartmentScores(session.user, "3M"),
  ]);

  return <OrgDashboardView session={session.user} initialOrg={org} initialDepts={depts} />;
}
