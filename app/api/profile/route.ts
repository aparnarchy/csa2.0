/**
 * POST /api/profile — the person edits their own sign-up details (name,
 * company, role, years of experience) from Profile. Writes ONLY the caller's
 * own records (WHERE id / userId = session user id), so privacy is enforced
 * here in server code.
 *
 * Company is locked for people their organisation set up (an admin roster
 * upload or invite put them in a team/department or gave them an employee ID):
 * the server ignores any company sent for them, not just the screen.
 */
export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";
import { getOwnDetails } from "@/lib/profile-details";

const MAX_LEN = 80;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => {
    const s = typeof v === "string" ? v.trim().slice(0, MAX_LEN) : "";
    return s.length ? s : null;
  };
  const name = str(body.name);
  if (!name) return NextResponse.json({ error: "Please add your name." }, { status: 400 });
  const role = str(body.currentRole);
  const yearsRaw = body.yearsOfExperience;
  const years = yearsRaw === "" || yearsRaw == null ? null : Number(yearsRaw);
  if (years !== null && (!Number.isFinite(years) || years < 0 || years > 70)) {
    return NextResponse.json({ error: "Years of experience should be a number from 0 to 70." }, { status: 400 });
  }

  const { env } = getRequestContext();
  const db = env.DB;
  const userId = session.user.id;
  const current = await getOwnDetails(db, userId);
  // Org-set people keep their company, whatever the request says.
  const company = current.companyLocked ? current.company : str(body.currentCompany);
  const now = new Date().toISOString();

  const writes = [
    db
      .prepare(
        `UPDATE user SET name = ?, currentCompany = ?, currentRole = ?, yearsOfExperience = ?, updatedAt = ?
          WHERE id = ?`,
      )
      .bind(name, company, role, years, now, userId),
  ];
  if (current.employmentId) {
    // The active job record is what dashboards, Career and Profile read.
    writes.push(
      current.companyLocked
        ? db.prepare("UPDATE employment SET designation = ? WHERE id = ? AND userId = ?").bind(role, current.employmentId, userId)
        : db
            .prepare("UPDATE employment SET designation = ?, companyName = ? WHERE id = ? AND userId = ?")
            .bind(role, company, current.employmentId, userId),
    );
  } else if (company || role) {
    // Same as onboarding: a self-signup with no job record yet gets one.
    writes.push(
      db
        .prepare(
          `INSERT INTO employment (id, userId, companyName, designation, workEmail, workEmailVerified, status, startedAt)
           VALUES (?, ?, ?, ?, ?, 1, 'active', ?)
           ON CONFLICT(id) DO UPDATE SET companyName = excluded.companyName, designation = excluded.designation`,
        )
        .bind(`emp-${userId.slice(0, 8)}`, userId, company, role, session.user.email, now.slice(0, 10)),
    );
  }
  await db.batch(writes);

  return NextResponse.json({ ok: true, details: await getOwnDetails(db, userId) });
}
