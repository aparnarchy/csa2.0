"use server";

/**
 * Employee response to a manager's feedback action. Identity re-derived from the
 * session; lib/feedback verifies the action is actually visible to this employee.
 */

import { getSession } from "@/lib/auth-session";
import { submitActionResponse } from "@/lib/feedback";
import type { ActionResponseValue } from "@/lib/data";

export async function submitActionResponseAction(
  actionId: string,
  response: ActionResponseValue,
  note?: string,
): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  await submitActionResponse(session.user, session.user.id, { actionId, response, note });
}
