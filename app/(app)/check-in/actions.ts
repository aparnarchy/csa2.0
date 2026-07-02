"use server";

/**
 * Check-in mutations. Client flows call these instead of the data layer directly,
 * so identity is re-derived from the session on the server (never trusted from the
 * client) and the real DB write in lib/checkins runs server-side.
 */

import { getSession } from "@/lib/auth-session";
import { submitCheckIn, submitFollowUp } from "@/lib/checkins";
import type { FollowUpStatus, PillarId } from "@/lib/types";

export async function submitCheckInAction(
  questionId: string,
  score: number,
  isRetrospective = false,
): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  await submitCheckIn(session.user, session.user.id, questionId, score, isRetrospective);
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
