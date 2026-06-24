/**
 * POST /api/preferences — saves the current user's look & feel preferences
 * (themeMode + persona). Writes ONLY the caller's own record (WHERE id = session
 * user id), so privacy is enforced here in server code. Values are validated
 * against the allowed sets; anything else falls back to the safe defaults.
 */
export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const themeMode = body.themeMode === "play" ? "play" : "professional";
  const persona = body.persona === "batman" ? "batman" : "spiderman";

  const { env } = getRequestContext();
  await env.DB.prepare(
    `UPDATE user SET themeMode = ?, persona = ?, updatedAt = ? WHERE id = ?`,
  )
    .bind(themeMode, persona, new Date().toISOString(), session.user.id)
    .run();

  return NextResponse.json({ ok: true, themeMode, persona });
}
