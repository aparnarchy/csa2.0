/**
 * POST /api/onboarding — saves the first-login onboarding form for the current
 * user and marks onboarding complete. Writes ONLY the caller's own record
 * (WHERE id = session user id), so privacy is enforced here in server code.
 *
 * A manager connection is linked by an admin/manager later (managerId FK), not
 * self-declared here — manager-invite is on hold, and the mentor feature was
 * cancelled, so neither is collected any more.
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

  const company = str(body.currentCompany);
  const role = str(body.currentRole);
  const now = new Date().toISOString();

  const { env } = getRequestContext();
  await env.DB.prepare(
    `UPDATE user
       SET name = ?, currentCompany = ?, currentRole = ?, yearsOfExperience = ?,
           onboardingComplete = 1, updatedAt = ?
     WHERE id = ?`,
  )
    .bind(
      str(body.name) ?? session.user.name,
      company,
      role,
      Number.isFinite(years as number) ? years : null,
      now,
      session.user.id,
    )
    .run();

  // Create the person's active EMPLOYMENT row (the lifelong-person / employment
  // split). Without this, employment-scoped screens (Profile role/company,
  // Career, tenure) render empty for every self-signup. Idempotent per user so a
  // re-submitted onboarding updates rather than duplicates.
  if (company || role) {
    const empId = `emp-${session.user.id.slice(0, 8)}`;
    await env.DB.prepare(
      `INSERT INTO employment
         (id, userId, companyName, designation, workEmail, workEmailVerified, status, startedAt)
       VALUES (?, ?, ?, ?, ?, 1, 'active', ?)
       ON CONFLICT(id) DO UPDATE SET companyName = excluded.companyName,
                                     designation = excluded.designation`,
    )
      .bind(empId, session.user.id, company, role, session.user.email, now.slice(0, 10))
      .run();
  }

  return NextResponse.json({ ok: true });
}
