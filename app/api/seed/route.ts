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

  // ── Career history is NOT seeded ─────────────────────────────────────────────
  // Past companies come only from the career questionnaire the user fills in, so
  // the screen never shows invented data. This clear-out removes rows left by
  // earlier seeds that did fabricate them.
  await db.prepare("DELETE FROM careerCompanies WHERE id LIKE 'cc-%'").run();
  results.push("Career history cleared (filled by the questionnaire, never seeded)");

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
  // Every option scores 4 / 7 / 10 — the app's standard three-point scale, the
  // same one the career questionnaire uses. Note the letters are ordered
  // worst -> best -> middle here (A=4, B=10, C=7), which is why the numbers
  // below don't read in order.
  const questions = [
    { id: "q1",  pillarId: "meaningful_work", text: "Do you get opportunities to tackle complex problems?",       a: "No, my work is routine",       as: 4, b: "Yes, regularly",     bs: 10,  c: "Sometimes",         cs: 7 },
    { id: "q2",  pillarId: "meaningful_work", text: "Does your work feel connected to a bigger purpose?",         a: "Not really",                   as: 4, b: "Absolutely",         bs: 10,  c: "Somewhat",           cs: 7 },
    { id: "q3",  pillarId: "growth",          text: "Are you learning new skills in your current role?",          a: "Rarely",                       as: 4, b: "Constantly",         bs: 10, c: "Occasionally",       cs: 7 },
    { id: "q4",  pillarId: "growth",          text: "Does your manager invest in your development?",              a: "Not at all",                   as: 4, b: "Very much",          bs: 10,  c: "Sometimes",          cs: 7 },
    { id: "q5",  pillarId: "growth",          text: "Do you have a clear path to grow in this company?",          a: "No",                           as: 4, b: "Yes, it's clear",    bs: 10,  c: "Somewhat",           cs: 7 },
    { id: "q6",  pillarId: "culture",         text: "Do you feel psychologically safe raising concerns?",         a: "No",                           as: 4, b: "Yes, always",        bs: 10, c: "Usually",            cs: 7 },
    { id: "q7",  pillarId: "culture",         text: "Does your team collaborate effectively?",                    a: "We struggle",                  as: 4, b: "Very well",          bs: 10,  c: "It varies",          cs: 7 },
    { id: "q8",  pillarId: "culture",         text: "Do you feel recognised for good work?",                      a: "Rarely",                       as: 4, b: "Regularly",          bs: 10,  c: "Sometimes",          cs: 7 },
    { id: "q9",  pillarId: "compensation",    text: "Do you feel fairly compensated for your work?",              a: "No",                           as: 4, b: "Yes",                bs: 10,  c: "Roughly",            cs: 7 },
    { id: "q10", pillarId: "compensation",    text: "Are your benefits competitive in the market?",               a: "Below market",                 as: 4, b: "Above market",       bs: 10,  c: "About average",      cs: 7 },
  ];
  for (const q of questions) {
    // REPLACE, not IGNORE: re-seeding must be able to correct the scores on a
    // question bank that already exists, otherwise a scale change never lands.
    await db
      .prepare(`INSERT OR REPLACE INTO questions
        (id, text, pillarId, optionA_text, optionA_score, optionB_text, optionB_score, optionC_text, optionC_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(q.id, q.text, q.pillarId, q.a, q.as, q.b, q.bs, q.c, q.cs)
      .run();
  }
  results.push("10 questions created");

  // ── Check-ins: every employee answers all 10 questions for W13–W23 ───────────
  //    (W24 is left open so the check-in flow has something "due").
  //
  //    A real check-in can only ever store 4, 7 or 10 — the score of whichever
  //    option was tapped — so the seed must not invent anything in between, or
  //    dev dashboards show distributions production can never produce. The
  //    per-pillar base, upward drift and noise are still what shape the data;
  //    they now set the ODDS of each answer rather than the score itself.
  //    Stored scoped to employment.
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

  /**
   * Turn a target average into one real answer of 4, 7 or 10.
   *
   * The target is clamped into range, then split between the two SURROUNDING
   * options in the proportion that makes the long-run average come out at the
   * target — e.g. 6.4 lands on 7 four times in five and on 4 the fifth time.
   * Mixing only adjacent options is what keeps a run of answers looking like a
   * person rather than a coin flip; the noise added by the caller is what
   * occasionally pushes a pillar far enough to reach the option beyond.
   */
  const pickScore = (target: number): number => {
    const t = Math.max(4, Math.min(10, target));
    if (t <= 7) return Math.random() < (t - 4) / 3 ? 7 : 4;
    return Math.random() < (t - 7) / 3 ? 10 : 7;
  };

  // Re-seeding has to be able to correct existing rows, and the ids are
  // deterministic (ci-1, ci-2, …), so clear the previous run rather than
  // INSERT OR IGNORE over the top of it and silently keep the old scores.
  await db.prepare("DELETE FROM checkIns WHERE id LIKE 'ci-%'").run();

  let ciIdx = 1;
  for (let wi = 0; wi < answeredWeeks.length; wi++) {
    const weekId = answeredWeeks[wi];
    const drift = (wi / answeredWeeks.length) * 1.0; // gentle improvement over time
    for (const userId of employeeIds) {
      for (const q of questions) {
        const base = pillarBase[q.pillarId] ?? 6.5;
        const noise = (Math.random() - 0.5) * 2.2;
        const score = pickScore(base + drift + noise);
        await db
          .prepare(`INSERT INTO checkIns (id, userId, questionId, pillarId, weekId, score, isRetrospective, employmentId)
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

  // ── Wisdom CMS content (so the admin Wisdom tab is populated) ────────────────
  await db.prepare("DELETE FROM wisdomContent WHERE id LIKE 'wc-%'").run();
  await db.prepare("DELETE FROM wisdomModules WHERE id LIKE 'wm-%'").run();
  const wisdomModules = [
    { id: "wm-mw-b", title: "Finding meaning in your work", pillarId: "meaningful_work", audience: "both", level: "beginner", badge: "Purpose Seeker" },
    { id: "wm-gr-b", title: "Growth mindset basics", pillarId: "growth", audience: "both", level: "beginner", badge: "Growth Explorer" },
    { id: "wm-cu-b", title: "Belonging at work", pillarId: "culture", audience: "both", level: "beginner", badge: "Culture Champion" },
    { id: "wm-co-b", title: "Know your worth", pillarId: "compensation", audience: "both", level: "beginner", badge: "Value Aware" },
    { id: "wm-gr-a", title: "Coaching your team to grow", pillarId: "growth", audience: "manager", level: "advanced", badge: "Growth Coach" },
  ];
  for (const m of wisdomModules) {
    await db
      .prepare("INSERT OR IGNORE INTO wisdomModules (id, title, pillarId, audience, level, badgeAwarded, isActive) VALUES (?, ?, ?, ?, ?, ?, 1)")
      .bind(m.id, m.title, m.pillarId, m.audience, m.level, m.badge)
      .run();
  }
  const wisdomContent = [
    { id: "wc-mw-1", moduleId: "wm-mw-b", title: "What meaningful work really means", type: "article", body: "A short read on connecting daily tasks to a bigger purpose.", sort: 0, hasQuiz: 0 },
    { id: "wc-mw-2", moduleId: "wm-mw-b", title: "Map your strengths to outcomes", type: "lesson", body: "An exercise to link what you're good at to what your team needs.", sort: 1, hasQuiz: 0 },
    { id: "wc-mw-3", moduleId: "wm-mw-b", title: "Meaningful work quiz", type: "quiz", body: null, sort: 2, hasQuiz: 1 },
    { id: "wc-gr-1", moduleId: "wm-gr-b", title: "The science of a growth mindset", type: "article", body: "Why believing skills can grow changes how you learn.", sort: 0, hasQuiz: 0 },
    { id: "wc-gr-2", moduleId: "wm-gr-b", title: "Spotting your learning edges", type: "video", body: null, sort: 1, hasQuiz: 0 },
    { id: "wc-gr-3", moduleId: "wm-gr-b", title: "Growth quiz", type: "quiz", body: null, sort: 2, hasQuiz: 1 },
    { id: "wc-cu-1", moduleId: "wm-cu-b", title: "Why belonging drives performance", type: "article", body: "How psychological safety lifts a whole team.", sort: 0, hasQuiz: 0 },
    { id: "wc-cu-2", moduleId: "wm-cu-b", title: "Small ways to build trust", type: "video", body: null, sort: 1, hasQuiz: 0 },
    { id: "wc-co-1", moduleId: "wm-co-b", title: "How to research your market value", type: "article", body: "Sources and benchmarks for a fair pay conversation.", sort: 0, hasQuiz: 0 },
    { id: "wc-co-2", moduleId: "wm-co-b", title: "Talking about pay with confidence", type: "video", body: null, sort: 1, hasQuiz: 0 },
    { id: "wc-ga-1", moduleId: "wm-gr-a", title: "Running a growth 1:1", type: "lesson", body: "A manager's template for a development-focused check-in.", sort: 0, hasQuiz: 0 },
  ];
  for (const c of wisdomContent) {
    const mod = wisdomModules.find((m) => m.id === c.moduleId)!;
    await db
      .prepare(
        `INSERT OR IGNORE INTO wisdomContent (id, moduleId, title, type, pillarId, audience, body, sortOrder, isActive, level, hasQuiz)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(c.id, c.moduleId, c.title, c.type, mod.pillarId, mod.audience, c.body, c.sort, mod.level, c.hasQuiz)
      .run();
  }
  results.push("Wisdom CMS content seeded");

  // ── Sample invites (so the admin Invites tab shows a list) ───────────────────
  await db.prepare("DELETE FROM invites WHERE id LIKE 'inv-%'").run();
  const adminId = createdUsers.find((u) => u.email === "admin@test.com")?.id ?? managerId;
  if (adminId) {
    const invites = [
      { id: "inv-1", email: "priya.new@acme.com", role: "employee", teamId, status: "pending" },
      { id: "inv-2", email: "sam.lead@acme.com", role: "manager", teamId: null, status: "pending" },
      { id: "inv-3", email: "jordan.hire@acme.com", role: "employee", teamId, status: "accepted" },
    ];
    for (const iv of invites) {
      await db
        .prepare("INSERT OR IGNORE INTO invites (id, email, role, invitedBy, teamId, status) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(iv.id, iv.email, iv.role, adminId, iv.teamId, iv.status)
        .run();
    }
    results.push("Sample invites seeded");
  }

  // ── Extra departments + teams (so the org chart looks like a real company) ───
  const extraDepts = [
    { id: "dept-product", name: "Product" },
    { id: "dept-sales", name: "Sales" },
  ];
  for (const d of extraDepts) {
    await db.prepare("INSERT OR IGNORE INTO departments (id, name) VALUES (?, ?)").bind(d.id, d.name).run();
  }
  const extraTeams = [
    { id: "team-design", name: "Design Team", deptId: "dept-product", managerId: null },
    { id: "team-sales", name: "Sales Team", deptId: "dept-sales", managerId: null },
  ];
  for (const t of extraTeams) {
    await db
      .prepare("INSERT OR IGNORE INTO teams (id, name, managerId, departmentId) VALUES (?, ?, ?, ?)")
      .bind(t.id, t.name, t.managerId, t.deptId)
      .run();
  }
  results.push("Extra org structure seeded");

  // ── Owner account: fully populate the real owner login so every screen shows
  //    its end state. Gives the owner employee data + all roles (to view every
  //    dashboard from one login). Does NOT touch the auth rows, so the owner
  //    keeps their own password. ────────────────────────────────────────────────
  const OWNER_EMAIL = "aparna@kissflow.com";
  const owner = await db
    .prepare('SELECT id FROM "user" WHERE email = ?')
    .bind(OWNER_EMAIL)
    .first<{ id: string }>();
  if (owner) {
    const oid = owner.id;
    // Clean any prior enrichment (leaves auth/account/session intact).
    for (const tbl of ["checkIns", "careerCompanies", "employment", "streaks", "user_badges"]) {
      await db.prepare(`DELETE FROM ${tbl} WHERE userId = ?`).bind(oid).run();
    }

    await db
      .prepare(
        'UPDATE "user" SET onboardingComplete = 1, teamId = ?, departmentId = ?, managerId = ?, currentCompany = ?, currentRole = ? WHERE id = ?',
      )
      .bind(teamId, deptId, managerId, "Kissflow", "Product Owner", oid)
      .run();

    for (const role of ["employee", "manager", "reviewing_manager", "ceo_hr", "admin"]) {
      await db.prepare("INSERT OR IGNORE INTO user_roles (userId, role) VALUES (?, ?)").bind(oid, role).run();
    }

    const oEmp = `emp-${oid.slice(0, 8)}`;
    await db
      .prepare(
        `INSERT OR IGNORE INTO employment
           (id, userId, companyName, departmentId, teamId, managerId, designation,
            workEmail, workEmailVerified, status, startedAt)
         VALUES (?, ?, 'Kissflow', ?, ?, ?, 'Product Owner', ?, 1, 'active', '2026-01-05')`,
      )
      .bind(oEmp, oid, deptId, teamId, managerId, OWNER_EMAIL)
      .run();

    let oIdx = 1;
    for (let wi = 0; wi < answeredWeeks.length; wi++) {
      const weekId = answeredWeeks[wi];
      const drift = (wi / answeredWeeks.length) * 1.0;
      for (const q of questions) {
        const base = pillarBase[q.pillarId] ?? 6.5;
        const score = pickScore(base + drift + (Math.random() - 0.5) * 2.2);
        await db
          .prepare(
            `INSERT INTO checkIns (id, userId, questionId, pillarId, weekId, score, isRetrospective, employmentId)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
          )
          .bind(`ci-owner-${oIdx++}`, oid, q.id, q.pillarId, weekId, score, oEmp)
          .run();
      }
    }

    await db
      .prepare("INSERT OR IGNORE INTO streaks (userId, currentStreak, longestStreak, lastCheckInWeek) VALUES (?, ?, ?, ?)")
      .bind(oid, streakLen, streakLen, lastWeek)
      .run();
    for (const [moduleId, badge] of [["mod-know-worth", "Value Aware"], ["mod-growth-mindset", "Growth Explorer"]]) {
      await db
        .prepare("INSERT OR IGNORE INTO user_badges (userId, badge, moduleId) VALUES (?, ?, ?)")
        .bind(oid, badge, moduleId)
        .run();
    }
    // No career history seeded for the owner either — see the note above.

    results.push(`Owner account (${OWNER_EMAIL}) fully populated with all roles`);
  } else {
    results.push(`Owner account (${OWNER_EMAIL}) not found — skipped`);
  }

  return NextResponse.json({ ok: true, results });
}
