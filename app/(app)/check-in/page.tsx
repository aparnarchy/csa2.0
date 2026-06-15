export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getDueCheckIns } from "@/lib/data";
import { CheckInFlow } from "./CheckInFlow";

export default async function CheckInPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const questions = await getDueCheckIns(session.user, session.user.id);
  return <CheckInFlow session={session.user} questions={questions} />;
}
