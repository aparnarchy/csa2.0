export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getDirectory } from "@/lib/admin";
import { PeopleView } from "./PeopleView";

/** Admin → People: everyone (signed up or not) in one table. Admin role only. */
export default async function PeoplePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("admin")) redirect("/dashboard");

  const directory = await getDirectory(session.user);

  return <PeopleView session={session.user} initial={directory} currentUserId={session.user.id} />;
}
