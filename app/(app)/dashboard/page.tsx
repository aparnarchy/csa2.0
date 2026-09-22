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

  // Anyone whose highest-privilege role outranks plain employee, but who ALSO
  // has their own active employment (does check-ins themselves), can switch
  // to see the employee experience instead — see the Profile screen's
  // "Switch view" button. Not just managers: an admin or CEO/HR account with
  // real employment (e.g. the owner's own account) needs this too, or the
  // switch silently does nothing for them.
  if (
    activeRole !== "employee" &&
    session.user.hasEmployment &&
    (await getViewMode()) === "employee"
  ) {
    redirect(ROLE_ROUTES.employee);
  }
  redirect(ROLE_ROUTES[activeRole]);
}
