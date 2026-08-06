export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getCeoDashboard } from "@/lib/ceo";
import { getCeoInsight } from "@/lib/ai";
import { DeptDetailView } from "../../DeptDetailView";

/** Department (or team) head view — reached by tapping a panel on the org dashboard. */
export default async function CeoDeptPage({
  params,
}: {
  params: Promise<{ deptId: string }>;
}) {
  const { deptId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("ceo_hr")) redirect("/dashboard");

  const data = await getCeoDashboard(session.user, deptId, "3M");
  const insight = await getCeoInsight("3M", data);

  return (
    <DeptDetailView session={session.user} scope={deptId} initial={data} initialInsight={insight} />
  );
}
