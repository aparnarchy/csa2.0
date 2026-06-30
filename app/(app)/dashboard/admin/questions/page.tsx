export const runtime = "edge";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { listQuestions } from "@/lib/admin";
import { QuestionBankView } from "./QuestionBankView";

/** Admin → Question bank (Phase 4.4). Admin role only. */
export default async function QuestionBankPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");
  if (!session.user.roles.includes("admin")) redirect("/dashboard");

  const questions = await listQuestions(session.user);

  return <QuestionBankView session={session.user} initial={questions} />;
}
