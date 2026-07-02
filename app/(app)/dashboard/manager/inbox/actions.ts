"use server";

/**
 * Manager Action Inbox mutations/reads. Identity re-derived from the session;
 * lib/feedback enforces role, own-team scoping and the ≥3 floor.
 */

import { getSession } from "@/lib/auth-session";
import { getManagerInbox, submitManagerAction } from "@/lib/feedback";
import type { ManagerActionDecision, ManagerInbox } from "@/lib/data";

export async function getManagerInboxAction(): Promise<ManagerInbox> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return getManagerInbox(session.user, "my-team");
}

export async function submitManagerActionAction(
  itemId: string,
  decision: ManagerActionDecision,
  note?: string,
): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  await submitManagerAction(session.user, { itemId, decision, note });
}
