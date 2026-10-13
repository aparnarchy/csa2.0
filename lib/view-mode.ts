"use server";

/**
 * View switch, for people who hold more than one role (e.g. admin + CEO/HR +
 * manager, each with their own employment). Persisted as a plain cookie (not
 * a DB column): it's "which hat am I wearing right now", not a durable
 * account setting.
 */

import { cookies } from "next/headers";
import type { Role } from "./types";

const COOKIE = "activeView";
/** Pre-picker cookie: only ever "employee" or "manager" (meaning "my top role"). */
const LEGACY_COOKIE = "viewAs";

const ROLES: Role[] = ["admin", "ceo_hr", "manager", "employee"];

/** Read the last pick, if any. Callers must resolve it against the roles the
    person actually holds (resolveView in lib/views.ts) — it's just "what they
    last chose", not itself an authorization. */
export async function getViewMode(): Promise<Role | null> {
  const jar = await cookies();
  const v = jar.get(COOKIE)?.value as Role | undefined;
  if (v && ROLES.includes(v)) return v;
  return jar.get(LEGACY_COOKIE)?.value === "employee" ? "employee" : null;
}

export async function setViewModeAction(view: Role): Promise<void> {
  if (!ROLES.includes(view)) return;
  const jar = await cookies();
  jar.set(COOKIE, view, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  jar.delete(LEGACY_COOKIE);
}
