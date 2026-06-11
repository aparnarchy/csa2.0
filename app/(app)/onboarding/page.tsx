export const runtime = "edge";
import { getSession } from "@/lib/auth-session";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.onboardingComplete) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="bg-white rounded-2xl p-8 shadow-sm w-full max-w-sm text-center">
        <div className="text-4xl mb-4">👋</div>
        <h1 className="text-xl font-bold text-gray-900">Welcome, {session.user.name}!</h1>
        <p className="text-sm text-gray-500 mt-2">
          Onboarding form coming in Phase 2.
        </p>
        <p className="text-xs text-gray-400 mt-4">
          Phase 1 stub — you&apos;re authenticated and gated correctly.
        </p>
      </div>
    </div>
  );
}
