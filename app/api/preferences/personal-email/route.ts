/**
 * POST /api/preferences/personal-email — saves (or clears) the current user's
 * optional personal email. Writes ONLY the caller's own record (WHERE id =
 * session user id), so privacy is enforced here in server code.
 */
export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const raw = typeof body.personalEmail === "string" ? body.personalEmail.trim().toLowerCase() : "";
  if (raw && !EMAIL_RE.test(raw)) {
    return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
  }
  if (raw && raw === session.user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "That's the email you sign in with — add a different, personal one." },
      { status: 400 },
    );
  }

  const { env } = getRequestContext();
  await env.DB.prepare("UPDATE user SET personalEmail = ?, updatedAt = ? WHERE id = ?")
    .bind(raw || null, new Date().toISOString(), session.user.id)
    .run();

  return NextResponse.json({ ok: true, personalEmail: raw || null });
}
