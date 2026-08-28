/**
 * POST /api/preferences/notifications — saves the current user's notification
 * toggles (reminders + weekly digest). Writes ONLY the caller's own record
 * (WHERE id = session user id), so privacy is enforced here in server code.
 * Separate from /api/preferences (look & feel) so an appearance change can
 * never accidentally reset these.
 */
export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const remindersEnabled = body.remindersEnabled !== false;
  const weeklyDigestEnabled = body.weeklyDigestEnabled !== false;

  const { env } = getRequestContext();
  await env.DB.prepare(
    `UPDATE user SET remindersEnabled = ?, weeklyDigestEnabled = ?, updatedAt = ? WHERE id = ?`,
  )
    .bind(remindersEnabled ? 1 : 0, weeklyDigestEnabled ? 1 : 0, new Date().toISOString(), session.user.id)
    .run();

  return NextResponse.json({ ok: true, remindersEnabled, weeklyDigestEnabled });
}
