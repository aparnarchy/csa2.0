export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getCeoDashboard } from "@/lib/ceo";
import { CeoHrView } from "./CeoHrView";

/** CEO / HR dashboard — org-wide aggregates with dept/team drill-down (Phase 4.3). */
export default async function CeoHrPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("ceo_hr")) redirect("/dashboard");

  const data = await getCeoDashboard(session.user, "org", "3M");

  return <CeoHrView session={session.user} initial={data} />;
}
