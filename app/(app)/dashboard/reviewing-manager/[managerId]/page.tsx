export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getReviewingManagerDetail } from "@/lib/reviewing";
import { getManagerDetailInsight } from "@/lib/ai";
import { ManagerDetailView } from "./ManagerDetailView";

/** Reviewing Manager — a single manager's team detail (Phase 4.2). */
export default async function ReviewingManagerDetailPage({
  params,
}: {
  params: Promise<{ managerId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("reviewing_manager") && !session.user.roles.includes("ceo_hr")) {
    redirect("/dashboard");
  }

  const { managerId } = await params;
  const detail = await getReviewingManagerDetail(session.user, managerId, "3M");
  const insight = await getManagerDetailInsight(managerId, "3M", detail);

  return <ManagerDetailView session={session.user} initial={detail} initialInsight={insight} />;
}
