"use server";

/**
 * Manager/employee view switch, for people who hold both — a person manages
 * a team AND has their own active employment (does check-ins themselves).
 * Persisted as a plain cookie (not a DB column): it's "which hat am I
 * wearing right now", not a durable account setting.
 */

import { cookies } from "next/headers";

const COOKIE = "viewAs";

export type ViewMode = "manager" | "employee";

/** Read the current override, if any. Callers still need to confirm the
    person actually holds both the role and the employment before trusting
    this — it's just "what they last chose", not itself an authorization. */
export async function getViewMode(): Promise<ViewMode | null> {
  const v = (await cookies()).get(COOKIE)?.value;
  return v === "employee" || v === "manager" ? v : null;
}

export async function setViewModeAction(mode: ViewMode): Promise<void> {
  (await cookies()).set(COOKIE, mode, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
}
