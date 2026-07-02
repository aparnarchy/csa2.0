"use server";

/**
 * CEO/HR dashboard read the client refreshes on scope/window change. Identity is
 * re-derived from the session; lib/ceo enforces the role + anonymisation floor.
 */

import { getSession } from "@/lib/auth-session";
import { getCeoDashboard } from "@/lib/ceo";
import type { CeoDashboard, Window } from "@/lib/data";

export async function getCeoDashboardAction(scope: string, window: Window): Promise<CeoDashboard> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getCeoDashboard(session.user, scope, window);
}
