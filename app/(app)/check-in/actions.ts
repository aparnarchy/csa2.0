"use server";

/**
 * Check-in mutations. Client flows call these instead of the data layer directly,
 * so identity is re-derived from the session on the server (never trusted from the
 * client) and the real DB write in lib/checkins runs server-side.
 */

import { getSession } from "@/lib/auth-session";
import { skipCheckIn, submitCheckIn, submitFollowUp } from "@/lib/checkins";
import type { FollowUpStatus, PillarId } from "@/lib/types";

/** Answer one delivered question. Whether it counts as retrospective (and so is
 *  excluded from the streak) is derived server-side from the assignment's week. */
export async function submitCheckInAction(assignmentId: string, score: number): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  await submitCheckIn(session.user, session.user.id, assignmentId, score);
}

/** "Skip this for now" on a catch-up question — drops it off the pending list. */
export async function skipCheckInAction(assignmentId: string): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  await skipCheckIn(session.user, session.user.id, assignmentId);
}

export async function submitFollowUpAction(input: {
  questionId: string;
  pillarId: PillarId;
  status: FollowUpStatus;
  journalText?: string;
}): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  await submitFollowUp(session.user, session.user.id, input);
}
