export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getEmployeeScores } from "@/lib/scores";
import { getDueCheckIns, getUnansweredCheckIns } from "@/lib/checkins";
import { AnalysisView } from "./AnalysisView";

export default async function EmployeeDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Load through the data layer (which runs the access-control guards).
  // getDueCheckIns also self-heals the week + assignments, so simply landing on
  // the dashboard is enough to "receive" this week's questions.
  const [initial, due, unanswered] = await Promise.all([
    getEmployeeScores(session.user, session.user.id, "3M"),
    getDueCheckIns(session.user, session.user.id),
    getUnansweredCheckIns(session.user, session.user.id),
  ]);

  return (
    <AnalysisView
      session={session.user}
      initial={initial}
      dueCount={due.length}
      pendingCount={unanswered.length}
    />
  );
}
