"use server";

/**
 * CEO/HR dashboard read the client refreshes on scope/window change. Identity is
 * re-derived from the session; lib/ceo enforces the role + anonymisation floor.
 */

import { getSession } from "@/lib/auth-session";
import {
  getCeoDashboard,
  getCeoPillarDetail,
  getDepartmentScores,
  type CeoPillarDetail,
  type DepartmentScore,
} from "@/lib/ceo";
import { getReviewingManagerList, getReviewingManagerDetail } from "@/lib/reviewing";
import { getCeoInsight, getManagerDetailInsight } from "@/lib/ai";
import type { CeoDashboard, ManagerDetail, ReviewingManagerList, Window } from "@/lib/data";
import type { PillarId } from "@/lib/types";

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

/** Every department's score — org dashboard panels + Insights bar chart. */
export async function getDepartmentScoresAction(window: Window): Promise<DepartmentScore[]> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getDepartmentScores(session.user, window);
}

/** Pillar detail at the current scope (org/dept/team) — clickable pillars. */
export async function getCeoPillarDetailAction(
  scope: string,
  pillarId: PillarId,
  window: Window,
): Promise<CeoPillarDetail> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getCeoPillarDetail(session.user, scope, pillarId, window);
}

/** Ranked manager list (top/bottom + "see all") — org-wide, CEO/HR only now. */
export async function getManagerRankingsAction(window: Window): Promise<ReviewingManagerList> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getReviewingManagerList(session.user, window);
}

export async function getManagerDetailAction(managerId: string, window: Window): Promise<ManagerDetail> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getReviewingManagerDetail(session.user, managerId, window);
}

/** AI snapshot for one manager's team — aggregates only, cached in D1. */
export async function getManagerDetailInsightAction(managerId: string, window: Window): Promise<string | null> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  const detail = await getReviewingManagerDetail(session.user, managerId, window);
  return getManagerDetailInsight(managerId, window, detail);
}
