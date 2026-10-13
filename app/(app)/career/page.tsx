export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getCareerHistory } from "@/lib/career";
import { getViewMode } from "@/lib/view-mode";
import { resolveView } from "@/lib/views";
import { CareerView } from "./CareerView";

/** Career history (Phase 2.8) + frozen company detail (2.8b). */
export default async function CareerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  // Career history is an employee-only surface — a plain manager's Profile
  // hides the entry point, so block direct navigation to match. But a
  // manager who ALSO has real employment (does their own check-ins, e.g. a
  // dual-role account) genuinely has a career to track, same as any
  // employee — gate on hasEmployment, not the role alone, or this wrongly
  // bounces them even while they're viewing the app as an employee.
  if (session.user.roles.includes("manager") && !session.user.hasEmployment) redirect("/profile");

  const history = await getCareerHistory(session.user, session.user.id);

  // Bottom nav follows the view they're in (CEO/HR nav only in CEO/HR view).
  const view = resolveView(session.user, await getViewMode());
  return <CareerView history={history} isCeoHr={view === "ceo_hr"} />;
}
