export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { AdminHubView } from "./AdminHubView";

/** Admin panel hub (Phase 4.4). Admin role only. */
export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("admin")) redirect("/dashboard");

  return <AdminHubView session={session.user} />;
}
