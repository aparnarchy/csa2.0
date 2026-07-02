export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getDueCheckIns, getOpenRecommendation, getUnansweredCheckIns } from "@/lib/checkins";
import { CheckInSession } from "./CheckInSession";

export default async function CheckInPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [unanswered, openRec, due] = await Promise.all([
    getUnansweredCheckIns(session.user, session.user.id),
    getOpenRecommendation(session.user, session.user.id),
    getDueCheckIns(session.user, session.user.id),
  ]);

  return (
    <CheckInSession session={session.user} unanswered={unanswered} openRec={openRec} due={due} />
  );
}
