/**
 * POST /api/onboarding — saves the first-login onboarding form for the current
 * user and marks onboarding complete. Writes ONLY the caller's own record
 * (WHERE id = session user id), so privacy is enforced here in server code.
 *
 * Manager name/email are collected in the form but not stored as text — a
 * manager connection is linked by an admin/manager later (managerId FK).
 */
export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const str = (v: unknown) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s.length ? s : null;
  };
  const years =
    body.yearsOfExperience === "" || body.yearsOfExperience == null
      ? null
      : Number(body.yearsOfExperience);

  const { env } = getRequestContext();
  await env.DB.prepare(
    `UPDATE user
       SET name = ?, currentCompany = ?, currentRole = ?, yearsOfExperience = ?,
           mentorName = ?, mentorEmail = ?, onboardingComplete = 1, updatedAt = ?
     WHERE id = ?`,
  )
    .bind(
      str(body.name) ?? session.user.name,
      str(body.currentCompany),
      str(body.currentRole),
      Number.isFinite(years as number) ? years : null,
      str(body.mentorName),
      str(body.mentorEmail),
      new Date().toISOString(),
      session.user.id,
    )
    .run();

  return NextResponse.json({ ok: true });
}
