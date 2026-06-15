export const runtime = "edge";

import { getSession } from "@/lib/auth-session";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.onboardingComplete) redirect("/dashboard");

  return (
    <div className="min-h-[100dvh] bg-lav-bg">
      <OnboardingForm defaultName={session.user.name} />
    </div>
  );
}
