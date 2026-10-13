/**
 * Which "views" (hats) a person can switch between: one per role they hold,
 * highest-privilege first. Plain logic, safe on client and server — it only
 * decides what to OFFER. Every page still checks the role on the server, so
 * picking a view you don't hold gets you nothing.
 */

import type { Role, SessionUser } from "./types";

export const VIEW_PRIORITY: Role[] = ["admin", "ceo_hr", "manager", "employee"];

export const VIEW_LABELS: Record<Role, string> = {
  admin: "Admin",
  ceo_hr: "CEO/HR",
  manager: "Manager",
  employee: "Employee",
};

/** The views this person can use. Employee view needs their own active job
 *  (it's their check-ins and scores) unless it's the only role they have. */
export function availableViews(user: Pick<SessionUser, "roles" | "hasEmployment">): Role[] {
  const elevated = VIEW_PRIORITY.filter((r) => r !== "employee" && user.roles.includes(r));
  if (elevated.length === 0) return ["employee"];
  return user.hasEmployment ? [...elevated, "employee"] : elevated;
}

/** The view to show: their last pick if they still hold it, else their highest role. */
export function resolveView(
  user: Pick<SessionUser, "roles" | "hasEmployment">,
  picked: Role | null,
): Role {
  const views = availableViews(user);
  return picked && views.includes(picked) ? picked : views[0];
}
