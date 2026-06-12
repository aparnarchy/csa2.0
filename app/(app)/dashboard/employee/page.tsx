export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getEmployeeScores } from "@/lib/data";
import { AnalysisView } from "./AnalysisView";

export default async function EmployeeDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Load through the data layer (which runs the access-control guards).
  const initial = await getEmployeeScores(session.user, session.user.id, "3M");

  return <AnalysisView session={session.user} initial={initial} />;
}
