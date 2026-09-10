export const runtime = "edge";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getViewMode } from "@/lib/view-mode";
import type { Role } from "@/lib/types";

const ROLE_ROUTES: Record<Role, string> = {
  admin: "/dashboard/admin",
  ceo_hr: "/dashboard/ceo-hr",
  manager: "/dashboard/manager",
  employee: "/dashboard/employee",
};

// Priority order — if a user has multiple roles, pick the highest-privilege one
const ROLE_PRIORITY: Role[] = ["admin", "ceo_hr", "manager", "employee"];

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");

  // Pick the highest-priority role this user holds
  const activeRole = ROLE_PRIORITY.find((r) => session.user.roles.includes(r)) ?? "employee";

  // A manager who also has their own active employment (does check-ins
  // themselves) can switch to see the employee experience instead — see
  // the Profile screen's "Switch view" button.
  if (activeRole === "manager" && session.user.hasEmployment && (await getViewMode()) === "employee") {
    redirect(ROLE_ROUTES.employee);
  }
  redirect(ROLE_ROUTES[activeRole]);
}
