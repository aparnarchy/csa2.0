import { createAuth } from "@/lib/auth";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { headers } from "next/headers";
import type { Role } from "@/lib/types";

export async function getSession() {
  const { env } = getRequestContext();
  const auth = createAuth(env.DB);
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  // Fetch roles from user_roles table
  const rolesResult = await env.DB.prepare(
    "SELECT role FROM user_roles WHERE userId = ?"
  )
    .bind(session.user.id)
    .all<{ role: Role }>();

  const roles = rolesResult.results.map((r: { role: Role }) => r.role);

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      onboardingComplete: (session.user as Record<string, unknown>).onboardingComplete as boolean ?? false,
      teamId: (session.user as Record<string, unknown>).teamId as string | null ?? null,
      roles,
    },
  };
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthenticated");
  }
  return session;
}
