"use server";

/**
 * Employee-dashboard reads that the client refreshes on window-change. Identity
 * is re-derived from the session (never trusted from the client) and the real
 * aggregation in lib/scores runs server-side (own-data only, assertOwner).
 */

import { getSession } from "@/lib/auth-session";
import { getEmployeeScores, getPillarDetail, type PillarDetail } from "@/lib/scores";
import { getRootAnalysis } from "@/lib/root-analysis";
import type { RootAnalysis } from "@/lib/rca";
import type { EmployeeScores, Window } from "@/lib/data";
import type { Persona, PillarId } from "@/lib/types";

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

/**
 * The real "Find the Root" analysis — AI-reasoned over this person's own
 * career history, check-in trends and journal reflections, falling back to
 * the deterministic engine (same `data` the caller already has on screen)
 * if there isn't enough data or the AI call doesn't pan out. Fetched on
 * demand when "Let's find out why" is tapped, not on every page load.
 */
export async function getRootAnalysisAction(
  data: EmployeeScores,
  persona?: Persona,
): Promise<RootAnalysis> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getRootAnalysis(session.user, session.user.id, data, persona);
}
