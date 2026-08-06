/**
 * Check-in scheduler (server-only).
 *
 * The spec: every employee gets *2* check-in questions per week, released on
 * random working days between 9am and 6pm, plus a way to catch up on questions
 * still pending from earlier weeks. This module is the engine that makes that
 * real. It writes rows into `checkInAssignments`; lib/checkins.ts reads them.
 *
 * Two entry points, both idempotent (safe to run repeatedly):
 *   - ensureUserAssignments(db, userId, now): cheap, per-user. Called on the read
 *     paths (check-in / dashboard) so the app is self-healing — a user always has
 *     this week's questions the moment they look, even with no external cron.
 *   - runWeeklyRollover(db, now): the heavy job for the cron endpoint. Rolls the
 *     active week forward and assigns 2 questions to *every* active employee.
 *
 * Because assignment ids are derived from (week, user, question) and inserts use
 * INSERT OR IGNORE, running either path twice never double-assigns.
 */

import { getDB } from "./db";

type DB = ReturnType<typeof getDB>;

// The seed anchored week W13 on Monday 2026-03-23. We keep numbering continuous
// from there so weekIds line up with the seeded history (…W22, W23, W24, …).
const SEED_ANCHOR_MONDAY_MS = Date.UTC(2026, 2, 23); // 2026-03-23
const SEED_ANCHOR_WEEKNUM = 13;

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

const QUESTIONS_PER_WEEK = 2;
const WORK_START_HOUR = 9; // 9am
const WORK_END_HOUR = 18; // 6pm (exclusive) — releases land in [9:00, 17:59]
const WORK_DAYS = 5; // Mon–Fri (week starts Monday, so day offsets 0..4)

export interface ActiveWeek {
  weekId: string;
  mondayMs: number; // 00:00 UTC of the week's Monday
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (Sunday)
}

// ── date helpers ─────────────────────────────────────────────────────────────

/** 00:00 UTC of the Monday of the week containing `now`. */
function mondayOf(now: Date): number {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dow = (new Date(midnight).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return midnight - dow * DAY_MS;
}

/** Continuous week id from the seed anchor, e.g. "2026-W32". */
function weekIdForMonday(mondayMs: number): string {
  const weeks = Math.round((mondayMs - SEED_ANCHOR_MONDAY_MS) / WEEK_MS);
  return `2026-W${SEED_ANCHOR_WEEKNUM + weeks}`;
}

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** SQLite datetime text ('YYYY-MM-DD HH:MM:SS') to compare with datetime('now'). */
const isoDateTime = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

const randInt = (lo: number, hiExclusive: number) =>
  lo + Math.floor(Math.random() * (hiExclusive - lo));

/** A random working-day/hour instant inside the given week (Mon–Fri, 9–18). */
function randomSlotMs(mondayMs: number, usedDayOffsets: Set<number>): number {
  let day = randInt(0, WORK_DAYS);
  // Prefer a day the other question didn't take, so the two land on different days.
  for (let i = 0; i < WORK_DAYS && usedDayOffsets.has(day); i++) day = (day + 1) % WORK_DAYS;
  usedDayOffsets.add(day);
  const hour = randInt(WORK_START_HOUR, WORK_END_HOUR);
  const minute = randInt(0, 60);
  return mondayMs + day * DAY_MS + hour * 3_600_000 + minute * 60_000;
}

// ── active week ──────────────────────────────────────────────────────────────

/**
 * Ensure the week containing `now` exists in weeklyWindows and is the single
 * active window (rolling the seeded W24 forward to the real current week). Cheap:
 * only writes when the active week is wrong. Returns the active week.
 */
export async function ensureActiveWeek(db: DB, now: Date = new Date()): Promise<ActiveWeek> {
  const mondayMs = mondayOf(now);
  const weekId = weekIdForMonday(mondayMs);
  const startDate = isoDate(mondayMs);
  const endDate = isoDate(mondayMs + 6 * DAY_MS);

  const current = await db
    .prepare("SELECT weekId FROM weeklyWindows WHERE isActive = 1 ORDER BY weekId DESC LIMIT 1")
    .first<{ weekId: string }>();

  if (current?.weekId !== weekId) {
    // Make sure the row exists (FK target for assignments/check-ins), then flip
    // the active flag onto it and off everything else.
    await db
      .prepare("INSERT OR IGNORE INTO weeklyWindows (weekId, startDate, endDate, isActive) VALUES (?, ?, ?, 0)")
      .bind(weekId, startDate, endDate)
      .run();
    await db.prepare("UPDATE weeklyWindows SET isActive = 0 WHERE isActive = 1").run();
    await db.prepare("UPDATE weeklyWindows SET isActive = 1 WHERE weekId = ?").bind(weekId).run();
  }

  return { weekId, mondayMs, startDate, endDate };
}

// ── assignment ───────────────────────────────────────────────────────────────

/**
 * Give one user their 2 questions for the given week, if they don't have them
 * yet. Picks active questions the user isn't already assigned this week,
 * preferring ones they didn't get last week so topics vary. Each release time is
 * a random working slot; the earliest is pulled back to `now` at the latest so a
 * logged-in user always has at least one live question rather than an empty week.
 */
async function assignForUser(db: DB, userId: string, week: ActiveWeek, now: Date): Promise<number> {
  const existing = await db
    .prepare("SELECT COUNT(*) AS n FROM checkInAssignments WHERE userId = ? AND weekId = ?")
    .bind(userId, week.weekId)
    .first<{ n: number }>();
  const need = QUESTIONS_PER_WEEK - (existing?.n ?? 0);
  if (need <= 0) return 0;

  const prevWeekId = weekIdForMonday(week.mondayMs - WEEK_MS);

  // Candidates: active, not already assigned this week, last-week's questions
  // sorted last so we vary topics when there's enough to choose from.
  const { results } = await db
    .prepare(
      `SELECT id FROM questions
        WHERE isActive = 1
          AND id NOT IN (SELECT questionId FROM checkInAssignments WHERE userId = ? AND weekId = ?)
        ORDER BY
          (id IN (SELECT questionId FROM checkInAssignments WHERE userId = ? AND weekId = ?)) ASC,
          RANDOM()
        LIMIT ?`,
    )
    .bind(userId, week.weekId, userId, prevWeekId, need)
    .all<{ id: string }>();
  if (results.length === 0) return 0;

  const usedDays = new Set<number>();
  const slots = results.map(() => randomSlotMs(week.mondayMs, usedDays)).sort((a, b) => a - b);
  // Guarantee the earliest question is already live (never a future-only week).
  slots[0] = Math.min(slots[0], now.getTime());

  let created = 0;
  for (let i = 0; i < results.length; i++) {
    const qid = results[i].id;
    const id = `asg-${week.weekId}-${userId}-${qid}`;
    const res = await db
      .prepare(
        `INSERT OR IGNORE INTO checkInAssignments (id, userId, questionId, weekId, releaseAt, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
      )
      .bind(id, userId, qid, week.weekId, isoDateTime(slots[i]))
      .run();
    if (res.meta.changes) created++;
  }
  return created;
}

/**
 * Self-healing per-user path for the read routes. Ensures the active week is
 * current and that this one user has their 2 questions for it.
 */
export async function ensureUserAssignments(
  db: DB,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const week = await ensureActiveWeek(db, now);
  await assignForUser(db, userId, week, now);
}

/**
 * The weekly job (cron endpoint): roll the active week forward and assign 2
 * questions to every active employee. Idempotent — re-running only fills gaps.
 */
export async function runWeeklyRollover(
  db: DB,
  now: Date = new Date(),
): Promise<{ weekId: string; users: number; assignmentsCreated: number }> {
  const week = await ensureActiveWeek(db, now);
  const { results } = await db
    .prepare("SELECT DISTINCT userId FROM employment WHERE status = 'active'")
    .all<{ userId: string }>();

  let created = 0;
  for (const r of results) created += await assignForUser(db, r.userId, week, now);
  return { weekId: week.weekId, users: results.length, assignmentsCreated: created };
}
