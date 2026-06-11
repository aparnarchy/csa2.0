import { betterAuth } from "better-auth";
import { Resend } from "resend";

export function createAuth(db: D1Database) {
  return betterAuth({
    database: {
      type: "sqlite",
      db,
    },
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
            <p>Click the link below to reset your password. The link expires in 1 hour.</p>
            <p><a href="${url}">Reset password</a></p>
            <p>If you didn't request this, you can ignore this email.</p>
          `,
        });
      },
    },
    user: {
      additionalFields: {
        onboardingComplete: {
          type: "boolean",
          defaultValue: false,
          required: false,
        },
        onboardingPath: {
          type: "string",
          required: false,
        },
        teamId: {
          type: "string",
          required: false,
        },
        managerId: {
          type: "string",
          required: false,
        },
        departmentId: {
          type: "string",
          required: false,
        },
        currentCompany: {
          type: "string",
          required: false,
        },
        currentRole: {
          type: "string",
          required: false,
        },
        yearsOfExperience: {
          type: "number",
          required: false,
        },
        mentorName: {
          type: "string",
          required: false,
        },
        mentorEmail: {
          type: "string",
          required: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
