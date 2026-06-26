export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getReviewingManagerList } from "@/lib/data";
import { ReviewingManagerView } from "./ReviewingManagerView";

/** Reviewing Manager — list of the managers who report to this reviewer (Phase 4.1). */
export default async function ReviewingManagerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("reviewing_manager") && !session.user.roles.includes("ceo_hr")) {
    redirect("/dashboard");
  }

  const list = await getReviewingManagerList(session.user, "3M");

  return <ReviewingManagerView session={session.user} initial={list} />;
}
