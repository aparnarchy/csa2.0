export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getCeoDashboard, getDepartmentScores } from "@/lib/ceo";
import { getReviewingManagerList } from "@/lib/reviewing";
import { CeoInsightsView } from "../CeoInsightsView";

/** CEO / HR Insights tab: department bar chart, top/bottom managers, pillar ranking. */
export default async function CeoInsightsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("ceo_hr")) redirect("/dashboard");

  const [depts, managers, scoped] = await Promise.all([
    getDepartmentScores(session.user, "3M"),
    getReviewingManagerList(session.user, "3M"),
    getCeoDashboard(session.user, "org", "3M"),
  ]);

  return (
    <CeoInsightsView
      session={session.user}
      initialDepts={depts}
      initialManagers={managers}
      initialScoped={scoped}
    />
  );
}
