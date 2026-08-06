export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getEmployeeScores } from "@/lib/scores";
import { getDueCheckIns, getUnansweredCheckIns } from "@/lib/checkins";
import { AnalysisView } from "./AnalysisView";

export default async function EmployeeDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  // The check-in is the entry GATE, not a prompt: opening the app lands on the
  // dashboard, and if there are questions waiting (this week's fresh ones or
  // pending ones from earlier weeks) we send the user through the full-screen
  // check-in flow first — which itself ends by routing back here. getDueCheckIns
  // also self-heals the week + assignments, so simply landing here "delivers"
  // this week's questions. Between check-ins (nothing due) → straight to the
  // dashboard below.
  const [due, unanswered] = await Promise.all([
    getDueCheckIns(session.user, session.user.id),
    getUnansweredCheckIns(session.user, session.user.id),
  ]);
  if (due.length > 0 || unanswered.length > 0) redirect("/check-in");

  // Nothing due — show the dashboard. (Access-control guards run in the layer.)
  const initial = await getEmployeeScores(session.user, session.user.id, "3M");
  return <AnalysisView session={session.user} initial={initial} />;
}
