export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getWisdom } from "@/lib/data";
import { WisdomView } from "@/app/(app)/wisdom/WisdomView";

/** Manager (leadership) Wisdom (Phase 3.4): the manager-audience learning path. */
export default async function ManagerWisdomPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("manager")) redirect("/dashboard");

  const wisdom = await getWisdom(session.user, session.user.id, "manager");
  const firstName = (session.user.name || "there").trim().split(/\s+/)[0];

  return (
    <WisdomView
      session={session.user}
      wisdom={wisdom}
      eyebrow="🧭 Leadership wisdom"
      title={`Lead better, ${firstName}`}
      mascotState="welcome"
      footnote="Leadership modules are ordered by your team's weakest pillar first."
      active="insights"
    />
  );
}
