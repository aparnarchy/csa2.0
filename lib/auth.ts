import { betterAuth } from "better-auth";
import { Resend } from "resend";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

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
      sendResetPassword: async ({ user, url }) => {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
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
