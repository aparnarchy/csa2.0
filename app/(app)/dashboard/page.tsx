export const runtime = "edge";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import type { Role } from "@/lib/types";

const ROLE_ROUTES: Record<Role, string> = {
  admin: "/dashboard/admin",
  ceo_hr: "/dashboard/ceo-hr",
  reviewing_manager: "/dashboard/reviewing-manager",
  manager: "/dashboard/manager",
  employee: "/dashboard/employee",
};

// Priority order — if a user has multiple roles, pick the highest-privilege one
const ROLE_PRIORITY: Role[] = ["admin", "ceo_hr", "reviewing_manager", "manager", "employee"];

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) redirect("/login");
  if (!session.user.onboardingComplete) redirect("/onboarding");

  // Pick the highest-priority role this user holds
  const activeRole = ROLE_PRIORITY.find((r) => session.user.roles.includes(r)) ?? "employee";
  redirect(ROLE_ROUTES[activeRole]);
}
