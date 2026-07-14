"use server";

/**
 * CEO/HR dashboard read the client refreshes on scope/window change. Identity is
 * re-derived from the session; lib/ceo enforces the role + anonymisation floor.
 */

import { getSession } from "@/lib/auth-session";
import { getCeoDashboard } from "@/lib/ceo";
import { getCeoInsight } from "@/lib/ai";
import type { CeoDashboard, Window } from "@/lib/data";

export async function getCeoDashboardAction(scope: string, window: Window): Promise<CeoDashboard> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getCeoDashboard(session.user, scope, window);
}

/** AI snapshot for the current scope — aggregates only, cached in D1. */
export async function getCeoInsightAction(scope: string, window: Window): Promise<string | null> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  const data = await getCeoDashboard(session.user, scope, window);
  return getCeoInsight(window, data);
}
