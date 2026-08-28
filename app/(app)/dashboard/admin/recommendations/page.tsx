export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getRecommendationsCms } from "@/lib/admin";
import { RecommendationsView } from "./RecommendationsView";

/** Admin → Recommendations (real content, one per question). Admin role only. */
export default async function RecommendationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("admin")) redirect("/dashboard");

  const recommendations = await getRecommendationsCms(session.user);

  return <RecommendationsView session={session.user} initial={recommendations} />;
}
