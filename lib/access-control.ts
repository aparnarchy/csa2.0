/**
 * Server-side access control layer.
 * Every data function that returns sensitive data must call one of these guards.
 * This is the privacy enforcement — it lives here in server code, not in the UI.
 */

import type { SessionUser } from "@/lib/types";

// ── Rule 1: personal records ──────────────────────────────────────────────────
// A user may only read/write their own check-ins, journals, streaks, etc.
export function assertOwner(session: SessionUser, resourceUserId: string) {
  if (session.id !== resourceUserId) {
    throw new AccessDeniedError("You can only access your own records.");
  }
}

// ── Rule 2: manager aggregates only ──────────────────────────────────────────
// Managers may never receive a raw check-in row that identifies an individual.
// Use this before returning any per-user score to a manager caller.
export function assertNotManagerReadingIndividual(session: SessionUser, targetUserId: string) {
  const isManager = session.roles.includes("manager");
  const isReadingOtherUser = session.id !== targetUserId;
  if (isManager && isReadingOtherUser) {
    throw new AccessDeniedError(
      "Managers may not access individual scores. Use aggregate functions only."
    );
  }
}

// ── Rule 3: manager action delay ─────────────────────────────────────────────
// An employee may not see a manager action before its visibleToEmployeesAt date.
export function assertActionVisible(visibleToEmployeesAt: string | null): void {
  if (!visibleToEmployeesAt) {
    throw new AccessDeniedError("This action has not been submitted yet.");
  }
  const visibleAt = new Date(visibleToEmployeesAt);
  if (new Date() < visibleAt) {
    throw new AccessDeniedError("This action is not yet visible.");
  }
}

// ── Rule 4: journal privacy ──────────────────────────────────────────────────
// Journal entries are returned only to their author — not managers, not admins.
export function assertJournalAuthor(session: SessionUser, journalUserId: string) {
  if (session.id !== journalUserId) {
    throw new AccessDeniedError("Journal entries are private to their author.");
  }
}

// ── Role guards ───────────────────────────────────────────────────────────────
export function assertRole(session: SessionUser, ...roles: SessionUser["roles"]) {
  const hasRole = roles.some((r) => session.roles.includes(r));
  if (!hasRole) {
    throw new AccessDeniedError(`Required role: ${roles.join(" or ")}`);
  }
}

// ── Anonymisation floor ───────────────────────────────────────────────────────
// Returns null (not the data) when there are fewer than 3 responses.
// Call this before returning any aggregate to a manager.
export function enforceAnonymisationFloor<T>(
  data: T,
  responseCount: number
): T | null {
  if (responseCount < 3) return null;
  return data;
}

// ── Error type ────────────────────────────────────────────────────────────────
export class AccessDeniedError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "AccessDeniedError";
  }
}
