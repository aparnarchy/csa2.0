"use server";

/**
 * Manager-dashboard read the client refreshes on window-change. Identity is
 * re-derived from the session; the real aggregation in lib/team enforces the
 * privacy rules (own team only, aggregates only, ≥3 anonymisation floor).
 */

import { getSession } from "@/lib/auth-session";
import { getTeamAggregate, getTeamPillarDetail, type TeamPillarDetail } from "@/lib/team";
import { getTeamInsight } from "@/lib/ai";
import type { PillarId } from "@/lib/types";
import type { TeamAggregate, Window } from "@/lib/data";

export async function getTeamAggregateAction(window: Window): Promise<TeamAggregate> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getTeamAggregate(session.user, "my-team", window);
}

/** Team-level detail for one pillar — the manager dashboard's pillar drill-down. */
export async function getTeamPillarDetailAction(
  pillarId: PillarId,
  window: Window,
): Promise<TeamPillarDetail> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getTeamPillarDetail(session.user, "my-team", pillarId, window);
}

/** AI snapshot for the manager's own team — aggregates only, cached in D1. */
export async function getTeamInsightAction(window: Window): Promise<string | null> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  const agg = await getTeamAggregate(session.user, "my-team", window);
  return getTeamInsight(session.user.id, window, agg);
}
