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
 *   employee2@test.com   → Employee (for anonymisation floor testing)
 *   employee3@test.com   → Employee (for anonymisation floor testing)
 */

import { createAuth } from "@/lib/auth";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { NextResponse } from "next/server";

export const runtime = "edge";

const SEED_USERS = [
  { email: "employee@test.com",  name: "Alice Employee",         role: "employee" as const },
  { email: "manager@test.com",   name: "Bob Manager",            role: "manager" as const },
  { email: "reviewing@test.com", name: "Carol Reviewing",        role: "reviewing_manager" as const },
  { email: "ceo@test.com",       name: "Dave CEO",               role: "ceo_hr" as const },
  { email: "admin@test.com",     name: "Eve Admin",              role: "admin" as const },
  { email: "employee2@test.com", name: "Frank Employee",         role: "employee" as const },
  { email: "employee3@test.com", name: "Grace Employee",         role: "employee" as const },
];

const PASSWORD = "password123";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Seed is only available in development" }, { status: 403 });
  }

  // Also block if called from non-localhost in dev
  const host = request.headers.get("host") ?? "";
  if (!host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    return NextResponse.json({ error: "Seed only available from localhost" }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = env.DB;
  const auth = createAuth(db);

  const results: string[] = [];

  // ── Create users via better-auth (hashes passwords correctly) ───────────────
  const createdUsers: Array<{ id: string; role: string }> = [];

  for (const u of SEED_USERS) {
    try {
      const ctx = await auth.api.signUpEmail({
        body: { email: u.email, password: PASSWORD, name: u.name },
      });
      createdUsers.push({ id: ctx.user.id, role: u.role });
      results.push(`Created user: ${u.email}`);
    } catch {
      // User might already exist — fetch their id
      const existing = await db
        .prepare("SELECT id FROM users WHERE email = ?")
        .bind(u.email)
        .first<{ id: string }>();
      if (existing) {
        createdUsers.push({ id: existing.id, role: u.role });
        results.push(`User already exists: ${u.email}`);
      }
    }
  }

  // ── Assign roles ─────────────────────────────────────────────────────────────
  for (const { id, role } of createdUsers) {
    await db
      .prepare("INSERT OR IGNORE INTO user_roles (userId, role) VALUES (?, ?)")
      .bind(id, role)
      .run();
    // All non-admin users also get the employee role
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
      .prepare("UPDATE users SET onboardingComplete = 1, onboardingPath = 'self_signup' WHERE id = ?")
      .bind(id)
      .run();
  }
  results.push("Onboarding marked complete");

  // ── Create department + team ─────────────────────────────────────────────────
  const deptId = "dept-engineering";
  const teamId = "team-engineering";
  const managerId = createdUsers.find((u) => SEED_USERS.find((s) => s.email === "manager@test.com" && u.role === "manager"))?.id;

  await db
    .prepare("INSERT OR IGNORE INTO departments (id, name) VALUES (?, ?)")
    .bind(deptId, "Engineering")
    .run();

  await db
    .prepare("INSERT OR IGNORE INTO teams (id, name, managerId, departmentId) VALUES (?, ?, ?, ?)")
    .bind(teamId, "Engineering Team", managerId ?? null, deptId)
    .run();

  // Link employees to the team
  for (const { id, role } of createdUsers) {
    if (["employee"].includes(role)) {
      await db
        .prepare("UPDATE users SET teamId = ?, departmentId = ?, managerId = ? WHERE id = ?")
        .bind(teamId, deptId, managerId ?? null, id)
        .run();
    }
  }
  results.push("Department and team created");

  // ── Create weekly windows ─────────────────────────────────────────────────────
  const windows = [
    { weekId: "2026-W21", startDate: "2026-05-18", endDate: "2026-05-24", isActive: 0 },
    { weekId: "2026-W22", startDate: "2026-05-25", endDate: "2026-05-31", isActive: 0 },
    { weekId: "2026-W23", startDate: "2026-06-01", endDate: "2026-06-07", isActive: 0 },
    { weekId: "2026-W24", startDate: "2026-06-08", endDate: "2026-06-14", isActive: 1 },
  ];
  for (const w of windows) {
    await db
      .prepare("INSERT OR IGNORE INTO weeklyWindows (weekId, startDate, endDate, isActive) VALUES (?, ?, ?, ?)")
      .bind(w.weekId, w.startDate, w.endDate, w.isActive)
      .run();
  }
  results.push("Weekly windows created");

  // ── Create 10 questions (2–3 per pillar) ────────────────────────────────────
  const questions = [
    { id: "q1", pillarId: "meaningful_work", text: "Do you get opportunities to tackle complex problems?", a: "No, my work is routine", as: 3, b: "Yes, regularly", bs: 9, c: "Sometimes", cs: 6 },
    { id: "q2", pillarId: "meaningful_work", text: "Does your work feel connected to a bigger purpose?", a: "Not really", as: 2, b: "Absolutely", bs: 9, c: "Somewhat", cs: 6 },
    { id: "q3", pillarId: "growth",          text: "Are you learning new skills in your current role?", a: "Rarely", as: 3, b: "Constantly", bs: 10, c: "Occasionally", cs: 6 },
    { id: "q4", pillarId: "growth",          text: "Does your manager invest in your development?", a: "Not at all", as: 2, b: "Very much", bs: 9, c: "Sometimes", cs: 5 },
    { id: "q5", pillarId: "growth",          text: "Do you have a clear path to grow in this company?", a: "No", as: 2, b: "Yes, it's clear", bs: 8, c: "Somewhat", cs: 5 },
    { id: "q6", pillarId: "culture",         text: "Do you feel psychologically safe raising concerns?", a: "No", as: 1, b: "Yes, always", bs: 10, c: "Usually", cs: 7 },
    { id: "q7", pillarId: "culture",         text: "Does your team collaborate effectively?", a: "We struggle", as: 3, b: "Very well", bs: 9, c: "It varies", cs: 6 },
    { id: "q8", pillarId: "culture",         text: "Do you feel recognised for good work?", a: "Rarely", as: 2, b: "Regularly", bs: 9, c: "Sometimes", cs: 5 },
    { id: "q9", pillarId: "compensation",    text: "Do you feel fairly compensated for your work?", a: "No", as: 2, b: "Yes", bs: 9, c: "Roughly", cs: 6 },
    { id: "q10", pillarId: "compensation",   text: "Are your benefits competitive in the market?", a: "Below market", as: 3, b: "Above market", bs: 9, c: "About average", cs: 6 },
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

  // ── Seed check-ins for the 3 employees across 3 past weeks ─────────────────
  const employeeIds = createdUsers
    .filter((u) => SEED_USERS.find((s) => ["employee@test.com","employee2@test.com","employee3@test.com"].includes(s.email) && u.id === u.id))
    .map((u) => u.id)
    .slice(0, 3);

  let checkInId = 1;
  for (const weekId of ["2026-W21", "2026-W22", "2026-W23"]) {
    for (const userId of employeeIds) {
      for (const q of questions.slice(0, 2)) {
        const score = Math.floor(Math.random() * 8) + 2;
        await db
          .prepare(`INSERT OR IGNORE INTO checkIns (id, userId, questionId, pillarId, weekId, score, isRetrospective)
            VALUES (?, ?, ?, ?, ?, ?, 0)`)
          .bind(`ci-${checkInId++}`, userId, q.id, q.pillarId, weekId, score)
          .run();
      }
    }
  }
  results.push("Check-ins seeded");

  // ── Seed streaks ─────────────────────────────────────────────────────────────
  for (const { id } of createdUsers.slice(0, 3)) {
    await db
      .prepare("INSERT OR IGNORE INTO streaks (userId, currentStreak, longestStreak, lastCheckInWeek) VALUES (?, ?, ?, ?)")
      .bind(id, 3, 3, "2026-W23")
      .run();
  }
  results.push("Streaks seeded");

  return NextResponse.json({ ok: true, results });
}
