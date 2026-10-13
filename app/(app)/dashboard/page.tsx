export const runtime = "edge";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getViewMode } from "@/lib/view-mode";
import { resolveView } from "@/lib/views";
import type { Role } from "@/lib/types";

const ROLE_ROUTES: Record<Role, string> = {
  admin: "/dashboard/admin",
  ceo_hr: "/dashboard/ceo-hr",
  manager: "/dashboard/manager",
  employee: "/dashboard/employee",
};

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");

  // Someone holding several roles lands on the view they last picked on the
  // Profile screen (Admin / CEO/HR / Manager / Employee), else their highest
  // role. Only views they actually hold count — see lib/views.ts — and each
  // dashboard re-checks its own role on the server anyway.
  const activeRole = resolveView(session.user, await getViewMode());
  redirect(ROLE_ROUTES[activeRole]);
}
