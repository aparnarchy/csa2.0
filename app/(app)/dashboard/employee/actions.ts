"use server";

/**
 * Employee-dashboard reads that the client refreshes on window-change. Identity
 * is re-derived from the session (never trusted from the client) and the real
 * aggregation in lib/scores runs server-side (own-data only, assertOwner).
 */

import { getSession } from "@/lib/auth-session";
import { getEmployeeScores, getPillarDetail, type PillarDetail } from "@/lib/scores";
import type { EmployeeScores, Window } from "@/lib/data";
import type { PillarId } from "@/lib/types";

export async function getEmployeeScoresAction(window: Window): Promise<EmployeeScores> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getEmployeeScores(session.user, session.user.id, window);
}

export async function getPillarDetailAction(
  pillarId: PillarId,
  window: Window,
): Promise<PillarDetail> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getPillarDetail(session.user, session.user.id, pillarId, window);
}
