export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { listPeople } from "@/lib/admin";
import { PeopleView } from "./PeopleView";

/** Admin → People & roles. Admin role only. */
export default async function PeoplePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("admin")) redirect("/dashboard");

  const people = await listPeople(session.user);

  return <PeopleView session={session.user} initial={people} currentUserId={session.user.id} />;
}
