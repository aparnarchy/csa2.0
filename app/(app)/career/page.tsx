export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getCareerHistory } from "@/lib/career";
import { CareerView } from "./CareerView";

/** Career history (Phase 2.8) + frozen company detail (2.8b). */
export default async function CareerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  // Career history is an employee-only surface — a manager's Profile hides the
  // entry point, so block direct navigation to match.
  if (session.user.roles.includes("manager")) redirect("/profile");

  const history = await getCareerHistory(session.user, session.user.id);

  return <CareerView history={history} />;
}
