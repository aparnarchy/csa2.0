export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getWisdom } from "@/lib/data";
import { WisdomView } from "./WisdomView";

/** Wisdom — the learning path (Phase 2.9). */
export default async function WisdomPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");

  const wisdom = await getWisdom(session.user, session.user.id);

  return <WisdomView session={session.user} wisdom={wisdom} />;
}
