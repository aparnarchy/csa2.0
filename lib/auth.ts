import { betterAuth } from "better-auth";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { hashPassword, verifyPassword } from "./auth-password";
import { sendEmail } from "./email";

/**
 * Which origins are allowed to sign in (better-auth's CSRF protection).
 * - Always trusts a configured production URL (set BETTER_AUTH_URL when deployed).
 * - In development, also trusts localhost and private-LAN addresses (wildcard
 *   patterns), so the owner can open the dev server on a phone over Wi-Fi/hotspot
 *   without an "invalid origin" error. These private ranges can't be forged by an
 *   external attacker's browser, and they're omitted entirely in production.
 */
function resolveTrustedOrigins(): string[] {
  const trusted: string[] = [];
  if (process.env.BETTER_AUTH_URL) trusted.push(process.env.BETTER_AUTH_URL);
  if (process.env.NODE_ENV !== "production") {
    trusted.push(
      "http://localhost:*",
      "http://127.0.0.1:*",
      "http://192.168.*",
      "http://10.*",
      "http://172.*",
      // Dev tunnels (cloudflared / localtunnel / ngrok) so phone testing can log in
      "https://*.trycloudflare.com",
      "https://*.loca.lt",
      "https://*.ngrok-free.app",
      "https://*.ngrok.io",
    );
  }
  return trusted;
}

/**
 * Open self-signup (locked decision — no invite-only gate) means anyone can
 * create an account before an admin's invite for them is ever looked at. This
 * closes that gap the other way round: the moment a new account is created, if
 * an admin already invited that email, place them where the invite (or roster
 * upload) put them — an immediately-active employment row on their team, its
 * department and their grade. Without a real employment row here, this person
 * would be invisible to every team/department aggregate until they separately
 * filled in the onboarding form — which nothing requires them to do before
 * using the app. No matching invite → plain employee, no employment row until
 * onboarding.
 *
 * Deliberately does NOT grant the manager role. Signup doesn't prove someone
 * owns the email they typed (the email service can't deliver to arbitrary
 * inboxes yet), so anyone could sign up as a manager's address first. Leading
 * a team is recorded on teams.pendingManagerEmail instead, and only takes
 * effect when an admin approves it (approvePendingManager in lib/admin.ts).
 * Being on a team is low-risk by comparison: members only ever see their own
 * data.
 */
async function applyPendingInvite(db: D1Database, userId: string, email: string): Promise<void> {
  const invite = await db
    .prepare(
      "SELECT id, teamId, departmentId, grade, employeeId FROM invites WHERE lower(email) = lower(?) AND status = 'pending' ORDER BY createdAt DESC LIMIT 1",
    )
    .bind(email)
    .first<{
      id: string;
      teamId: string | null;
      departmentId: string | null;
      grade: string | null;
      employeeId: string | null;
    }>();
  if (!invite) return;

  // The department the roster gave this person wins; otherwise they take
  // their team's.
  let departmentId: string | null = invite.departmentId;
  if (!departmentId && invite.teamId) {
    const team = await db
      .prepare("SELECT departmentId FROM teams WHERE id = ?")
      .bind(invite.teamId)
      .first<{ departmentId: string | null }>();
    departmentId = team?.departmentId ?? null;
  }

  // Never let a clashing employee ID block someone's signup — drop the ID
  // (the admin sees it missing in People and can fix it) rather than fail.
  let employeeId = invite.employeeId;
  if (employeeId) {
    const taken = await db
      .prepare("SELECT 1 AS x FROM employment WHERE lower(employeeId) = lower(?) AND status = 'active'")
      .bind(employeeId)
      .first<{ x: number }>();
    if (taken) employeeId = null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const empId = `emp-${userId.slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO employment (id, userId, teamId, departmentId, grade, employeeId, status, startedAt, workEmail, workEmailVerified)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET teamId = excluded.teamId, departmentId = excluded.departmentId,
                                      grade = excluded.grade, employeeId = excluded.employeeId, status = 'active'`,
    )
    .bind(empId, userId, invite.teamId, departmentId, invite.grade, employeeId, today, email)
    .run();

  // Keep the cached user.teamId/departmentId columns (used for display
  // convenience elsewhere) in sync with the real employment row.
  await db
    .prepare("UPDATE user SET teamId = ?, departmentId = ? WHERE id = ?")
    .bind(invite.teamId, departmentId, userId)
    .run();

  await db.prepare("UPDATE invites SET status = 'accepted' WHERE id = ?").bind(invite.id).run();
}

export function createAuth(db: D1Database) {
  const kysely = new Kysely({ dialect: new D1Dialect({ database: db }) });

  return betterAuth({
    database: {
      type: "sqlite",
      db: kysely,
    },
    trustedOrigins: resolveTrustedOrigins(),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      // Native WebCrypto PBKDF2 instead of better-auth's default pure-JS scrypt,
      // which is too CPU-heavy for the Cloudflare Workers free-tier limit and
      // makes sign-in/sign-up 503. See lib/auth-password.ts.
      password: { hash: hashPassword, verify: verifyPassword },
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          from: "CSA <noreply@resend.dev>",
          to: user.email,
          subject: "Reset your CSA password",
          html: `
            <p>Hi ${user.name},</p>
            <p>Click the link below to reset your password. It expires in 1 hour.</p>
            <p><a href="${url}">Reset password</a></p>
            <p>If you didn't request this, ignore this email.</p>
          `,
        });
      },
    },
    user: {
      additionalFields: {
        onboardingComplete: { type: "boolean", defaultValue: false },
        onboardingPath:     { type: "string",  required: false },
        teamId:             { type: "string",  required: false },
        managerId:          { type: "string",  required: false },
        departmentId:       { type: "string",  required: false },
        currentCompany:     { type: "string",  required: false },
        currentRole:        { type: "string",  required: false },
        yearsOfExperience:  { type: "number",  required: false },
        themeMode:          { type: "string",  defaultValue: "professional" },
        persona:            { type: "string",  defaultValue: "spiderman" },
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            // Every new signup gets the employee role by default
            await db
              .prepare("INSERT OR IGNORE INTO user_roles (userId, role) VALUES (?, 'employee')")
              .bind(user.id)
              .run();
            await applyPendingInvite(db, user.id, user.email);
            // A team this email was named to lead stays pending here — an
            // admin approves it (see applyPendingInvite's comment for why).
          },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
