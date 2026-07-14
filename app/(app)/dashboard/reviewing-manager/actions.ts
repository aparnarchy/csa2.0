"use server";

/**
 * Reviewing-manager reads the client refreshes on window-change. Identity is
 * re-derived from the session; lib/reviewing + lib/team enforce role + privacy.
 */

import { getSession } from "@/lib/auth-session";
import { getReviewingManagerDetail, getReviewingManagerList } from "@/lib/reviewing";
import { getManagerDetailInsight } from "@/lib/ai";
import type { ManagerDetail, ReviewingManagerList, Window } from "@/lib/data";

export async function getReviewingManagerListAction(window: Window): Promise<ReviewingManagerList> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getReviewingManagerList(session.user, window);
}

export async function getReviewingManagerDetailAction(
  managerId: string,
  window: Window,
): Promise<ManagerDetail> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getReviewingManagerDetail(session.user, managerId, window);
}

/** AI snapshot for one manager's team — aggregates only, cached in D1. */
export async function getManagerDetailInsightAction(
  managerId: string,
  window: Window,
): Promise<string | null> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  const detail = await getReviewingManagerDetail(session.user, managerId, window);
  return getManagerDetailInsight(managerId, window, detail);
}
