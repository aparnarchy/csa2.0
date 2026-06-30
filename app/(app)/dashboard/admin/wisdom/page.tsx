export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getWisdomCms } from "@/lib/admin";
import { WisdomCmsView } from "./WisdomCmsView";

/** Admin → Wisdom content CMS (Phase 4.4). Admin role only. */
export default async function WisdomCmsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("admin")) redirect("/dashboard");

  const modules = await getWisdomCms(session.user);

  return <WisdomCmsView session={session.user} initial={modules} />;
}
