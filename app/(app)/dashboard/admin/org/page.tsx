export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getOrgStructure } from "@/lib/admin";
import { OrgStructureView } from "./OrgStructureView";

/** Admin → Org structure (Phase 4.4). Admin role only. */
export default async function OrgStructurePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("admin")) redirect("/dashboard");

  const org = await getOrgStructure(session.user);

  return <OrgStructureView session={session.user} initial={org} />;
}
