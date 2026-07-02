"use server";

/**
 * Reviewing-manager reads the client refreshes on window-change. Identity is
 * re-derived from the session; lib/reviewing + lib/team enforce role + privacy.
 */

import { getSession } from "@/lib/auth-session";
import { getReviewingManagerDetail, getReviewingManagerList } from "@/lib/reviewing";
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
