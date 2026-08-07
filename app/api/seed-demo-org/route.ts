/**
 * Admin-only demo-org seeder.
 * POST /api/seed-demo-org — adds 9 named departments (Customer Support,
 * Finance & Operations, Marketing, People Operations, Revenue Operations,
 * Sales - Americas/APAC/EMEA/India) each with a team, a manager, and 4
 * employees with real check-in history, so the CEO/HR org dashboard and
 * manager leaderboard have a full, believable spread to demo — no department
 * below the anonymity floor. Also renames the existing "Engineering"
 * department to "Product" per the owner (same id, same real test data —
 * employee@test.com etc. are untouched).
 *
 * SAFE TO RUN IN PRODUCTION (admin-gated, not env-blocked like /api/seed) and
 * idempotent (INSERT OR IGNORE / re-runnable). Call once per department via
 * ?dept=<slug> (support, finance, marketing, peopleops, revops, sales-am,
 * sales-apac, sales-emea, sales-in) — doing all 9 in one request exceeds
 * Cloudflare's per-invocation D1 subrequest limit even after batching. Every
 * row this creates is
 * prefixed "demo-" (departments/teams) or uses a "@csademo.test" email
 * (people) — DELETE BEFORE REAL LAUNCH: this is temporary data for the
 * owner's manager-facing demo, see the prelaunch-delete-test-accounts note.
 *
 *   DELETE FROM checkIns WHERE employmentId IN (SELECT id FROM employment WHERE id LIKE 'emp-demo-%');
 *   DELETE FROM streaks WHERE userId IN (SELECT id FROM user WHERE email LIKE '%@csademo.test');
 *   DELETE FROM employment WHERE id LIKE 'emp-demo-%';
 *   DELETE FROM user_roles WHERE userId IN (SELECT id FROM user WHERE email LIKE '%@csademo.test');
 *   DELETE FROM teams WHERE id LIKE 'team-demo-%';
 *   DELETE FROM departments WHERE id LIKE 'dept-demo-%';
 *   DELETE FROM user WHERE email LIKE '%@csademo.test';
 */

import { createAuth } from "@/lib/auth";
import { getSession } from "@/lib/auth-session";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { NextResponse } from "next/server";

export const runtime = "edge";

const PASSWORD = "password123";

interface DemoPerson {
  slug: string; // used in the email, unique per person
  name: string;
  designation: string;
}

interface DemoDept {
  slug: string; // used in dept-demo-<slug> / team-demo-<slug>
  deptName: string;
  teamName: string;
  manager: DemoPerson;
  employees: DemoPerson[];
  /** Target long-run average overall score for this team (4-10). */
  targetAvg: number;
}

const DEMO_DEPTS: DemoDept[] = [
  {
    slug: "support", deptName: "Customer Support", teamName: "Customer Support Team", targetAvg: 8.3,
    manager: { slug: "support-mgr", name: "Priya Sundaram", designation: "Support Manager" },
    employees: [
      { slug: "support-1", name: "Neha Verma", designation: "Support Specialist" },
      { slug: "support-2", name: "Arjun Singh", designation: "Support Specialist" },
      { slug: "support-3", name: "Fatima Khan", designation: "Support Specialist" },
      { slug: "support-4", name: "Leo Martins", designation: "Support Specialist" },
    ],
  },
  {
    slug: "finance", deptName: "Finance & Operations", teamName: "Finance & Operations Team", targetAvg: 7.8,
    manager: { slug: "finance-mgr", name: "Karan Mehta", designation: "Finance Manager" },
    employees: [
      { slug: "finance-1", name: "Sophia Chen", designation: "Financial Analyst" },
      { slug: "finance-2", name: "Daniel Cohen", designation: "Financial Analyst" },
      { slug: "finance-3", name: "Priyanka Rao", designation: "Operations Analyst" },
      { slug: "finance-4", name: "Rahul Gupta", designation: "Operations Analyst" },
    ],
  },
  {
    slug: "marketing", deptName: "Marketing", teamName: "Marketing Team", targetAvg: 6.9,
    manager: { slug: "marketing-mgr", name: "Meera Iyer", designation: "Marketing Manager" },
    employees: [
      { slug: "marketing-1", name: "Zara Ali", designation: "Marketing Associate" },
      { slug: "marketing-2", name: "Tom Becker", designation: "Content Strategist" },
      { slug: "marketing-3", name: "Isabella Rossi", designation: "Marketing Associate" },
      { slug: "marketing-4", name: "Vikram Nair", designation: "Growth Marketer" },
    ],
  },
  {
    slug: "peopleops", deptName: "People Operations", teamName: "People Operations Team", targetAvg: 7.5,
    manager: { slug: "peopleops-mgr", name: "Ananya Kapoor", designation: "People Ops Manager" },
    employees: [
      { slug: "peopleops-1", name: "Grace Lin", designation: "HR Generalist" },
      { slug: "peopleops-2", name: "Samuel Osei", designation: "Recruiter" },
      { slug: "peopleops-3", name: "Aisha Patel", designation: "HR Generalist" },
      { slug: "peopleops-4", name: "Marco Rossi", designation: "People Ops Analyst" },
    ],
  },
  {
    slug: "revops", deptName: "Revenue Operations", teamName: "Revenue Operations Team", targetAvg: 6.2,
    manager: { slug: "revops-mgr", name: "Rohan Deshpande", designation: "RevOps Manager" },
    employees: [
      { slug: "revops-1", name: "Nikhil Shah", designation: "RevOps Analyst" },
      { slug: "revops-2", name: "Emma Wilson", designation: "RevOps Analyst" },
      { slug: "revops-3", name: "Carlos Diaz", designation: "Sales Ops Specialist" },
      { slug: "revops-4", name: "Yuki Tanaka", designation: "RevOps Analyst" },
    ],
  },
  {
    slug: "sales-am", deptName: "Sales - Americas", teamName: "Americas Sales Team", targetAvg: 8.6,
    manager: { slug: "sales-am-mgr", name: "Jake Foster", designation: "Sales Manager, Americas" },
    employees: [
      { slug: "sales-am-1", name: "Ashley Brown", designation: "Account Executive" },
      { slug: "sales-am-2", name: "Miguel Torres", designation: "Account Executive" },
      { slug: "sales-am-3", name: "Rachel Kim", designation: "Account Executive" },
      { slug: "sales-am-4", name: "Ben Foster", designation: "Sales Development Rep" },
    ],
  },
  {
    slug: "sales-apac", deptName: "Sales - APAC", teamName: "APAC Sales Team", targetAvg: 5.4,
    manager: { slug: "sales-apac-mgr", name: "Wei Zhang", designation: "Sales Manager, APAC" },
    employees: [
      { slug: "sales-apac-1", name: "Mei Zhang", designation: "Account Executive" },
      { slug: "sales-apac-2", name: "Raj Kumar", designation: "Account Executive" },
      { slug: "sales-apac-3", name: "Lily Wong", designation: "Sales Development Rep" },
      { slug: "sales-apac-4", name: "Kenji Sato", designation: "Account Executive" },
    ],
  },
  {
    slug: "sales-emea", deptName: "Sales - EMEA", teamName: "EMEA Sales Team", targetAvg: 6.7,
    manager: { slug: "sales-emea-mgr", name: "Oliver Bennett", designation: "Sales Manager, EMEA" },
    employees: [
      { slug: "sales-emea-1", name: "Hugo Silva", designation: "Account Executive" },
      { slug: "sales-emea-2", name: "Amara Obi", designation: "Account Executive" },
      { slug: "sales-emea-3", name: "Lucas Meyer", designation: "Sales Development Rep" },
      { slug: "sales-emea-4", name: "Nadia Petrova", designation: "Account Executive" },
    ],
  },
  {
    slug: "sales-in", deptName: "Sales - India", teamName: "India Sales Team", targetAvg: 4.6,
    manager: { slug: "sales-in-mgr", name: "Aditi Rao", designation: "Sales Manager, India" },
    employees: [
      { slug: "sales-in-1", name: "Rohit Sharma", designation: "Account Executive" },
      { slug: "sales-in-2", name: "Divya Iyer", designation: "Account Executive" },
      { slug: "sales-in-3", name: "Karthik Reddy", designation: "Sales Development Rep" },
      { slug: "sales-in-4", name: "Sneha Gupta", designation: "Account Executive" },
    ],
  },
];

// Same 4-pillar shape as the main seed's pillarBase, offset per person so a
// team's average lands near targetAvg while still varying by pillar.
const PILLAR_OFFSET: Record<string, number> = {
  meaningful_work: 0.5,
  growth: -0.5,
  culture: 0.3,
  compensation: -0.6,
};

/** Same 4/7/10 rounding as the main seed — never invent an in-between score. */
function pickScore(target: number): number {
  const t = Math.max(4, Math.min(10, target));
  if (t <= 7) return Math.random() < (t - 4) / 3 ? 7 : 4;
  return Math.random() < (t - 7) / 3 ? 10 : 7;
}

const WEEK_NUMS = Array.from({ length: 11 }, (_, i) => 13 + i); // W13..W23 (matches the main seed)
const ANSWERED_WEEKS = WEEK_NUMS.map((wk) => `2026-W${wk}`);

const QUESTIONS = [
  { id: "q1", pillarId: "meaningful_work" }, { id: "q2", pillarId: "meaningful_work" },
  { id: "q3", pillarId: "growth" }, { id: "q4", pillarId: "growth" }, { id: "q5", pillarId: "growth" },
  { id: "q6", pillarId: "culture" }, { id: "q7", pillarId: "culture" }, { id: "q8", pillarId: "culture" },
  { id: "q9", pillarId: "compensation" }, { id: "q10", pillarId: "compensation" },
];

/**
 * Cloudflare caps the number of D1 calls (subrequests) a single Worker
 * invocation can make. Seeding all 9 departments' full check-in history in one
 * request blew past it ("Too many API requests by single Worker invocation").
 * Two fixes: batch every employee's ~110 check-in rows into ONE db.batch()
 * call instead of 110 separate .run()s, AND process one department per HTTP
 * request (?dept=<slug>) so even an unbatched step never accumulates across
 * departments. Omit ?dept to run the shared setup (rename + drop placeholders)
 * plus the first department only — call again per slug for the rest.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.user.roles.includes("admin")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = env.DB;
  const auth = createAuth(db);
  const results: string[] = [];

  const url = new URL(request.url);
  const onlySlug = url.searchParams.get("dept");

  if (!onlySlug) {
    // Rename Engineering -> Product (same id, same real data — nothing else changes).
    await db.prepare("UPDATE departments SET name = 'Product' WHERE id = 'dept-engineering'").run();
    results.push("Renamed Engineering department to Product");

    // Drop the old empty placeholder departments/teams (no manager, no employees).
    await db.prepare("DELETE FROM teams WHERE id IN ('team-design', 'team-sales')").run();
    await db.prepare("DELETE FROM departments WHERE id IN ('dept-product', 'dept-sales')").run();
    results.push("Removed empty placeholder departments (old Product/Sales)");
  }

  const targets = onlySlug ? DEMO_DEPTS.filter((d) => d.slug === onlySlug) : DEMO_DEPTS;
  if (onlySlug && targets.length === 0) {
    return NextResponse.json({ error: `Unknown dept slug "${onlySlug}"` }, { status: 400 });
  }

  for (const dept of targets) {
    const deptId = `dept-demo-${dept.slug}`;
    const teamId = `team-demo-${dept.slug}`;

    await db.prepare("INSERT OR IGNORE INTO departments (id, name) VALUES (?, ?)").bind(deptId, dept.deptName).run();

    // Manager
    let managerId: string;
    const mgrEmail = `d-${dept.manager.slug}@csademo.test`;
    const existingMgr = await db.prepare('SELECT id FROM "user" WHERE email = ?').bind(mgrEmail).first<{ id: string }>();
    if (existingMgr) {
      managerId = existingMgr.id;
    } else {
      const ctx = await auth.api.signUpEmail({ body: { email: mgrEmail, password: PASSWORD, name: dept.manager.name } });
      managerId = ctx.user.id;
      await db.prepare("INSERT OR IGNORE INTO user_roles (userId, role) VALUES (?, 'manager')").bind(managerId).run();
      await db
        .prepare('UPDATE "user" SET onboardingComplete = 1, onboardingPath = \'self_signup\', currentCompany = ?, currentRole = ? WHERE id = ?')
        .bind("Kissflow", dept.manager.designation, managerId)
        .run();
    }

    await db
      .prepare("INSERT INTO teams (id, name, managerId, departmentId) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET managerId = excluded.managerId, departmentId = excluded.departmentId")
      .bind(teamId, dept.teamName, managerId, deptId)
      .run();

    // Employees
    for (const person of dept.employees) {
      const email = `d-${person.slug}@csademo.test`;
      let userId: string;
      const existing = await db.prepare('SELECT id FROM "user" WHERE email = ?').bind(email).first<{ id: string }>();
      if (existing) {
        userId = existing.id;
      } else {
        const ctx = await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: person.name } });
        userId = ctx.user.id;
        await db.prepare("INSERT OR IGNORE INTO user_roles (userId, role) VALUES (?, 'employee')").bind(userId).run();
      }
      await db
        .prepare(
          'UPDATE "user" SET onboardingComplete = 1, onboardingPath = \'self_signup\', teamId = ?, departmentId = ?, managerId = ?, currentCompany = ?, currentRole = ? WHERE id = ?',
        )
        .bind(teamId, deptId, managerId, "Kissflow", person.designation, userId)
        .run();

      const empId = `emp-demo-${person.slug}`;
      await db
        .prepare(
          `INSERT INTO employment (id, userId, companyName, departmentId, teamId, managerId, designation, workEmail, workEmailVerified, status, startedAt)
           VALUES (?, ?, 'Kissflow', ?, ?, ?, ?, ?, 1, 'active', '2026-01-05')
           ON CONFLICT(id) DO UPDATE SET departmentId = excluded.departmentId, teamId = excluded.teamId, managerId = excluded.managerId`,
        )
        .bind(empId, userId, deptId, teamId, managerId, person.designation, email)
        .run();

      // Check-ins W13-W23, scored around this team's target average. Batched
      // into ONE D1 call (delete + ~110 inserts + streak upsert) — the whole
      // reason this route hit the subrequest cap was doing these one at a time.
      const stmts = [db.prepare("DELETE FROM checkIns WHERE id LIKE ?").bind(`ci-${empId}-%`)];
      let idx = 1;
      for (const weekId of ANSWERED_WEEKS) {
        for (const q of QUESTIONS) {
          const offset = PILLAR_OFFSET[q.pillarId] ?? 0;
          const noise = (Math.random() - 0.5) * 1.6;
          const score = pickScore(dept.targetAvg + offset + noise);
          stmts.push(
            db
              .prepare(
                `INSERT INTO checkIns (id, userId, questionId, pillarId, weekId, score, isRetrospective, employmentId)
                 VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
              )
              .bind(`ci-${empId}-${idx++}`, userId, q.id, q.pillarId, weekId, score, empId),
          );
        }
      }
      stmts.push(
        db
          .prepare(
            "INSERT INTO streaks (userId, currentStreak, longestStreak, lastCheckInWeek) VALUES (?, ?, ?, ?) ON CONFLICT(userId) DO UPDATE SET currentStreak = excluded.currentStreak, longestStreak = excluded.longestStreak, lastCheckInWeek = excluded.lastCheckInWeek",
          )
          .bind(userId, ANSWERED_WEEKS.length, ANSWERED_WEEKS.length, ANSWERED_WEEKS[ANSWERED_WEEKS.length - 1]),
      );
      await db.batch(stmts);
    }

    results.push(`${dept.deptName}: team + manager + ${dept.employees.length} employees seeded (target ${dept.targetAvg})`);
  }

  return NextResponse.json({ ok: true, results });
}
