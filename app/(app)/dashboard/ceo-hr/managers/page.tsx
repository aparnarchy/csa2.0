export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getReviewingManagerList } from "@/lib/reviewing";
import { AllManagersView } from "./AllManagersView";

/** All managers, ranked — the "see all" click-through from the Insights tab. */
export default async function CeoManagersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("ceo_hr")) redirect("/dashboard");

  const data = await getReviewingManagerList(session.user, "3M");
  return <AllManagersView initial={data} />;
}
