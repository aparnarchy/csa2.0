export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getCareerHistory } from "@/lib/data";
import { CareerView } from "./CareerView";

/** Career history (Phase 2.8) + frozen company detail (2.8b). */
export default async function CareerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");

  const history = await getCareerHistory(session.user, session.user.id);

  return <CareerView session={session.user} history={history} />;
}
