/**
 * Development-only seed route.
 * POST /api/seed — wipes and repopulates the local D1 with test data.
 * Blocked in production.
 *
 * Seeded users (password: "password123" for all):
 *   employee@test.com    → Employee role, on Engineering team
 *   manager@test.com     → Manager role, manages Engineering team
 *   reviewing@test.com   → Reviewing Manager role
 *   ceo@test.com         → CEO/HR role
 *   admin@test.com       → Admin role
 *   employee2@test.com   → Employee (anonymisation floor testing)
 *   employee3@test.com   → Employee (anonymisation floor testing)
 */

import { createAuth } from "@/lib/auth";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { NextResponse } from "next/server";

export const runtime = "edge";

const SEED_USERS = [
  { email: "employee@test.com",  name: "Alice Employee",  role: "employee"          as const },
  { email: "manager@test.com",   name: "Bob Manager",     role: "manager"           as const },
  { email: "reviewing@test.com", name: "Carol Reviewing", role: "reviewing_manager" as const },
  { email: "ceo@test.com",       name: "Dave CEO",        role: "ceo_hr"            as const },
  { email: "admin@test.com",     name: "Eve Admin",       role: "admin"             as const },
  { email: "employee2@test.com", name: "Frank Employee",  role: "employee"          as const },
  { email: "employee3@test.com", name: "Grace Employee",  role: "employee"          as const },
];

const PASSWORD = "password123";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Seed only available in development" }, { status: 403 });
  }
  const host = request.headers.get("host") ?? "";
  if (!host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    return NextResponse.json({ error: "Seed only available from localhost" }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = env.DB;
  const auth = createAuth(db);
  const results: string[] = [];

  // ── Wipe existing test data for a clean slate ────────────────────────────────
  const testEmails = SEED_USERS.map((u) => `'${u.email}'`).join(",");
  const existingUsers = await db
    .prepare(`SELECT id FROM "user" WHERE email IN (${testEmails})`)
    .all<{ id: string }>();
  for (const { id } of existingUsers.results) {
    await db.prepare(`DELETE FROM "user" WHERE id = ?`).bind(id).run();
    await db.prepare(`DELETE FROM account WHERE userId = ?`).bind(id).run();
    await db.prepare(`DELETE FROM session WHERE userId = ?`).bind(id).run();
    await db.prepare(`DELETE FROM user_roles WHERE userId = ?`).bind(id).run();
  }
  await db.prepare("DELETE FROM checkIns WHERE id LIKE 'ci-%'").run();
  await db.prepare("DELETE FROM employment WHERE id LIKE 'emp-%'").run();
  await db.prepare("DELETE FROM weeklyWindows WHERE weekId LIKE '2026-W%'").run();
  await db.prepare("DELETE FROM questions WHERE id LIKE 'q%'").run();
  await db.prepare("DELETE FROM teams WHERE id = 'team-engineering'").run();
  await db.prepare("DELETE FROM departments WHERE id = 'dept-engineering'").run();
  results.push("Wiped existing seed data");

  // ── Create users via better-auth ─────────────────────────────────────────────
  const createdUsers: Array<{ id: string; email: string; role: typeof SEED_USERS[number]["role"] }> = [];

  for (const u of SEED_USERS) {
    try {
      const ctx = await auth.api.signUpEmail({
        body: { email: u.email, password: PASSWORD, name: u.name },
      });
      createdUsers.push({ id: ctx.user.id, email: u.email, role: u.role });
      results.push(`Created: ${u.email}`);
    } catch (err) {
      results.push(`Error creating ${u.email}: ${String(err)}`);
    }
  }

  // ── Assign non-default roles ─────────────────────────────────────────────────
  for (const { id, role } of createdUsers) {
    if (role !== "employee") {
      await db
        .prepare("INSERT OR IGNORE INTO user_roles (userId, role) VALUES (?, ?)")
        .bind(id, role)
        .run();
    }
    // Non-admin users also get the employee role (for the check-in flow)
    if (role !== "admin") {
      await db
        .prepare("INSERT OR IGNORE INTO user_roles (userId, role) VALUES (?, 'employee')")
        .bind(id)
        .run();
    }
  }
  results.push("Roles assigned");

  // ── Mark all as onboarding complete ─────────────────────────────────────────
  for (const { id } of createdUsers) {
    await db
      .prepare("UPDATE \"user\" SET onboardingComplete = 1, onboardingPath = 'self_signup' WHERE id = ?")
      .bind(id)
      .run();
  }
  results.push("Onboarding marked complete");

  // ── Department + team ────────────────────────────────────────────────────────
  const managerId = createdUsers.find((u) => u.email === "manager@test.com")?.id ?? null;
  const deptId = "dept-engineering";
  const teamId = "team-engineering";

  await db
    .prepare("INSERT OR IGNORE INTO departments (id, name) VALUES (?, ?)")
    .bind(deptId, "Engineering")
    .run();

  await db
    .prepare("INSERT OR IGNORE INTO teams (id, name, managerId, departmentId) VALUES (?, ?, ?, ?)")
    .bind(teamId, "Engineering Team", managerId, deptId)
    .run();

  const employeeEmails = ["employee@test.com", "employee2@test.com", "employee3@test.com"];
  // employment: one active row per employee (the lifelong-person / employment split).
  const employmentByUser = new Map<string, string>();
  for (const { id, email } of createdUsers) {
    if (employeeEmails.includes(email)) {
      await db
        .prepare('UPDATE "user" SET teamId = ?, departmentId = ?, managerId = ? WHERE id = ?')
        .bind(teamId, deptId, managerId, id)
        .run();
      const empId = `emp-${id.slice(0, 8)}`;
      employmentByUser.set(id, empId);
      await db
        .prepare(
          `INSERT OR IGNORE INTO employment
             (id, userId, companyName, departmentId, teamId, managerId, designation,
              workEmail, workEmailVerified, status, startedAt)
           VALUES (?, ?, 'Kissflow', ?, ?, ?, 'Software Engineer', ?, 1, 'active', '2026-01-05')`,
        )
        .bind(empId, id, deptId, teamId, managerId, email)
        .run();
    }
  }
  results.push("Department, team and employment created");

  // ── Weekly windows (W13–W24; W13 Monday = 2026-03-23 → W24 = 2026-06-08) ──────
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const W13_MONDAY = new Date("2026-03-23T00:00:00Z");
  const WEEK_NUMS = Array.from({ length: 12 }, (_, i) => 13 + i); // 13..24
  const windows = WEEK_NUMS.map((wk, i) => {
    const start = new Date(W13_MONDAY);
    start.setUTCDate(start.getUTCDate() + i * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return {
      weekId: `2026-W${wk}`,
      startDate: iso(start),
      endDate: iso(end),
      isActive: wk === 24 ? 1 : 0, // only the latest week is open for check-in
    };
  });
  for (const w of windows) {
    await db
      .prepare("INSERT OR IGNORE INTO weeklyWindows (weekId, startDate, endDate, isActive) VALUES (?, ?, ?, ?)")
      .bind(w.weekId, w.startDate, w.endDate, w.isActive)
      .run();
  }
  results.push("Weekly windows created");

  // ── 10 questions ─────────────────────────────────────────────────────────────
  const questions = [
    { id: "q1",  pillarId: "meaningful_work", text: "Do you get opportunities to tackle complex problems?",       a: "No, my work is routine",       as: 3, b: "Yes, regularly",     bs: 9,  c: "Sometimes",         cs: 6 },
    { id: "q2",  pillarId: "meaningful_work", text: "Does your work feel connected to a bigger purpose?",         a: "Not really",                   as: 2, b: "Absolutely",         bs: 9,  c: "Somewhat",           cs: 6 },
    { id: "q3",  pillarId: "growth",          text: "Are you learning new skills in your current role?",          a: "Rarely",                       as: 3, b: "Constantly",         bs: 10, c: "Occasionally",       cs: 6 },
    { id: "q4",  pillarId: "growth",          text: "Does your manager invest in your development?",              a: "Not at all",                   as: 2, b: "Very much",          bs: 9,  c: "Sometimes",          cs: 5 },
    { id: "q5",  pillarId: "growth",          text: "Do you have a clear path to grow in this company?",          a: "No",                           as: 2, b: "Yes, it's clear",    bs: 8,  c: "Somewhat",           cs: 5 },
    { id: "q6",  pillarId: "culture",         text: "Do you feel psychologically safe raising concerns?",         a: "No",                           as: 1, b: "Yes, always",        bs: 10, c: "Usually",            cs: 7 },
    { id: "q7",  pillarId: "culture",         text: "Does your team collaborate effectively?",                    a: "We struggle",                  as: 3, b: "Very well",          bs: 9,  c: "It varies",          cs: 6 },
    { id: "q8",  pillarId: "culture",         text: "Do you feel recognised for good work?",                      a: "Rarely",                       as: 2, b: "Regularly",          bs: 9,  c: "Sometimes",          cs: 5 },
    { id: "q9",  pillarId: "compensation",    text: "Do you feel fairly compensated for your work?",              a: "No",                           as: 2, b: "Yes",                bs: 9,  c: "Roughly",            cs: 6 },
    { id: "q10", pillarId: "compensation",    text: "Are your benefits competitive in the market?",               a: "Below market",                 as: 3, b: "Above market",       bs: 9,  c: "About average",      cs: 6 },
  ];
  for (const q of questions) {
    await db
      .prepare(`INSERT OR IGNORE INTO questions
        (id, text, pillarId, optionA_text, optionA_score, optionB_text, optionB_score, optionC_text, optionC_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(q.id, q.text, q.pillarId, q.a, q.as, q.b, q.bs, q.c, q.cs)
      .run();
  }
  results.push("10 questions created");

  // ── Check-ins: every employee answers all 10 questions for W13–W23 ───────────
  //    (W24 is left open so the check-in flow has something "due"). Scores lean on
  //    a per-pillar base + a small upward drift + noise, so pillar cards and the
  //    trend look believable and differ by pillar. Stored scoped to employment.
  const employeeIds = createdUsers
    .filter((u) => employeeEmails.includes(u.email))
    .map((u) => u.id);
  const pillarBase: Record<string, number> = {
    meaningful_work: 7.6,
    growth: 6.4,
    culture: 7.1,
    compensation: 5.6,
  };
  const answeredWeeks = WEEK_NUMS.filter((wk) => wk !== 24).map((wk) => `2026-W${wk}`);
  const clampScore = (n: number) => Math.max(1, Math.min(10, Math.round(n)));
  let ciIdx = 1;
  for (let wi = 0; wi < answeredWeeks.length; wi++) {
    const weekId = answeredWeeks[wi];
    const drift = (wi / answeredWeeks.length) * 1.0; // gentle improvement over time
    for (const userId of employeeIds) {
      for (const q of questions) {
        const base = pillarBase[q.pillarId] ?? 6.5;
        const noise = (Math.random() - 0.5) * 2.2;
        const score = clampScore(base + drift + noise);
        await db
          .prepare(`INSERT OR IGNORE INTO checkIns (id, userId, questionId, pillarId, weekId, score, isRetrospective, employmentId)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?)`)
          .bind(`ci-${ciIdx++}`, userId, q.id, q.pillarId, weekId, score, employmentByUser.get(userId) ?? null)
          .run();
      }
    }
  }
  results.push(`Check-ins seeded (${ciIdx - 1} rows)`);

  // ── Streaks ──────────────────────────────────────────────────────────────────
  const streakLen = answeredWeeks.length;
  const lastWeek = answeredWeeks[answeredWeeks.length - 1];
  for (const { id, email } of createdUsers) {
    if (employeeEmails.includes(email)) {
      await db
        .prepare("INSERT OR IGNORE INTO streaks (userId, currentStreak, longestStreak, lastCheckInWeek) VALUES (?, ?, ?, ?)")
        .bind(id, streakLen, streakLen, lastWeek)
        .run();
    }
  }
  results.push("Streaks seeded");

  return NextResponse.json({ ok: true, results });
}
