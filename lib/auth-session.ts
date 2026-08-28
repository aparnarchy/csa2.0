import { createAuth } from "@/lib/auth";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { headers } from "next/headers";
import type { Persona, Role, ThemeMode } from "@/lib/types";

export async function getSession() {
  const { env } = getRequestContext();
  const auth = createAuth(env.DB);
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const u = session.user as Record<string, unknown>;

  const rolesResult = await env.DB.prepare(
    "SELECT role FROM user_roles WHERE userId = ?"
  )
    .bind(session.user.id)
    .all<{ role: Role }>();

  const roles: Role[] = rolesResult.results.map((r: { role: Role }) => r.role);

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      onboardingComplete: Boolean(u.onboardingComplete ?? false),
      teamId: (u.teamId as string | null) ?? null,
      themeMode: (u.themeMode === "play" ? "play" : "professional") as ThemeMode,
      persona: (u.persona === "batman" ? "batman" : "spiderman") as Persona,
      remindersEnabled: (u.remindersEnabled ?? 1) !== 0,
      weeklyDigestEnabled: (u.weeklyDigestEnabled ?? 1) !== 0,
      roles,
    },
  };
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("Unauthenticated");
  return session;
}
