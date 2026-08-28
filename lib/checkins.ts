/**
 * Real check-in data access (first slice of the mock→D1 migration).
 *
 * SERVER-ONLY: this module calls getDB() (Cloudflare request context), so it
 * must never be imported by a client component. Screens read these from server
 * components; client components mutate through the server actions in
 * app/(app)/check-in/actions.ts. Types + pure helpers still live in lib/data.ts
 * so client code can import them safely.
 *
 * Privacy: every function is own-data only (assertOwner) — no aggregation here.
 */

import { getDB } from "./db";
import { assertOwner } from "./access-control";
import { loadRecommendations, pickRecommendation } from "./recommendations";
import { ensureUserAssignments, ensureActiveWeek } from "./scheduler";
import type {
  CheckInQuestion,
  LatestCheckIn,
  OpenRecommendation,
  OpenRecommendationItem,
  Reflection,
  RecommendationHistoryItem,
} from "./data";
import type { FollowUpStatus, PillarId, SessionUser } from "./types";

/** A question row joined to its assignment (assignmentId, weekId, startDate). */
interface AssignedQuestionRow {
  assignmentId: string;
  weekId: string;
  startDate: string | null;
  id: string;
  text: string;
  pillarId: PillarId;
  optionA_text: string;
  optionA_score: number;
  optionB_text: string;
  optionB_score: number;
  optionC_text: string;
  optionC_score: number;
}

/** The columns every assigned-question query selects, so the shape stays in sync. */
const ASSIGNED_QUESTION_COLS = `
  a.id AS assignmentId, a.weekId AS weekId, w.startDate AS startDate,
  q.id AS id, q.text AS text, q.pillarId AS pillarId,
  q.optionA_text, q.optionA_score, q.optionB_text, q.optionB_score, q.optionC_text, q.optionC_score`;

function toCheckInQuestion(
  q: AssignedQuestionRow,
  withLabel: boolean,
  recMap: Map<string, string>,
): CheckInQuestion {
  return {
    assignmentId: q.assignmentId,
    weekId: q.weekId,
    id: q.id,
    text: q.text,
    pillarId: q.pillarId,
    options: [
      { key: "A", text: q.optionA_text, score: q.optionA_score },
      { key: "B", text: q.optionB_text, score: q.optionB_score },
      { key: "C", text: q.optionC_text, score: q.optionC_score },
    ],
    recommendation: pickRecommendation(recMap, q.id, q.pillarId),
    weekLabel: withLabel ? monthLabel(q.startDate) : undefined,
  };
}

/** "2026-06-01" → "June 2026" for the catch-up chip. */
function monthLabel(startDate: string | null): string | undefined {
  if (!startDate) return undefined;
  const [y, m] = startDate.split("-");
  const mi = Number(m) - 1;
  return MONTHS[mi] ? `${MONTHS[mi]} ${y}` : undefined;
}

type DB = ReturnType<typeof getDB>;

/** The current open check-in window, or null if none is active. */
async function getActiveWeekId(db: DB): Promise<string | null> {
  const row = await db
    .prepare("SELECT weekId FROM weeklyWindows WHERE isActive = 1 ORDER BY weekId DESC LIMIT 1")
    .first<{ weekId: string }>();
  return row?.weekId ?? null;
}

/** The user's active employment, so check-ins can be scoped to it (Phase A). */
async function getActiveEmploymentId(db: DB, userId: string): Promise<string | null> {
  const row = await db
    .prepare(
      "SELECT id FROM employment WHERE userId = ? AND status = 'active' ORDER BY startedAt DESC LIMIT 1",
    )
    .bind(userId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-06-01" → "June 2026" for the Inbox date line. Falls back to the weekId. */
async function weekLabel(db: DB, weekId: string): Promise<string> {
  const row = await db
    .prepare("SELECT startDate FROM weeklyWindows WHERE weekId = ?")
    .bind(weekId)
    .first<{ startDate: string }>();
  if (!row?.startDate) return weekId;
  const [y, m] = row.startDate.split("-");
  const mi = Number(m) - 1;
  return MONTHS[mi] ? `${MONTHS[mi]} ${y}` : weekId;
}

/**
 * This week's questions that have been released (releaseAt has passed) and are
 * still pending — at most the 2 assigned for the week. Self-heals first: makes
 * sure the active week is current and this user has their 2 assignments, so a
 * logged-in user always has something to answer without any external cron.
 * Own data only.
 */
export async function getDueCheckIns(
  session: SessionUser,
  userId: string,
): Promise<CheckInQuestion[]> {
  assertOwner(session, userId);
  const db = getDB();
  await ensureUserAssignments(db, userId);
  const week = await getActiveWeekId(db);
  if (!week) return [];
  const { results } = await db
    .prepare(
      `SELECT ${ASSIGNED_QUESTION_COLS}
         FROM checkInAssignments a
         JOIN questions q ON q.id = a.questionId
         JOIN weeklyWindows w ON w.weekId = a.weekId
        WHERE a.userId = ? AND a.weekId = ? AND a.status = 'pending'
          AND a.releaseAt <= datetime('now')
        ORDER BY a.releaseAt ASC`,
    )
    .bind(userId, week)
    .all<AssignedQuestionRow>();
  const recMap = await loadRecommendations();
  return results.map((r) => toCheckInQuestion(r, false, recMap));
}

/**
 * Questions released in *earlier* weeks that are still pending — the catch-up /
 * Inbox "unanswered" list, oldest first. Self-heals the active week first so a
 * long-absent user's stale week rolls forward before we decide what's overdue.
 * Own data only.
 */
export async function getUnansweredCheckIns(
  session: SessionUser,
  userId: string,
): Promise<CheckInQuestion[]> {
  assertOwner(session, userId);
  const db = getDB();
  const week = await ensureActiveWeek(db);
  const { results } = await db
    .prepare(
      `SELECT ${ASSIGNED_QUESTION_COLS}
         FROM checkInAssignments a
         JOIN questions q ON q.id = a.questionId
         JOIN weeklyWindows w ON w.weekId = a.weekId
        WHERE a.userId = ? AND a.weekId <> ? AND a.status = 'pending'
          AND a.releaseAt <= datetime('now')
        ORDER BY a.releaseAt ASC`,
    )
    .bind(userId, week.weekId)
    .all<AssignedQuestionRow>();
  const recMap = await loadRecommendations();
  return results.map((r) => toCheckInQuestion(r, true, recMap));
}

/**
 * Record the answer for one assignment and mark it answered. The check-in is
 * stored against the assignment's own week (so a late catch-up lands in the week
 * it was for, not today), and counts as retrospective when that isn't the active
 * week — retrospective answers don't advance the streak. Idempotent: the check-in
 * id is derived from (week, question, user). Own data only.
 */
export async function submitCheckIn(
  session: SessionUser,
  userId: string,
  assignmentId: string,
  score: number,
): Promise<void> {
  assertOwner(session, userId);
  const db = getDB();
  const a = await db
    .prepare(
      "SELECT questionId, weekId FROM checkInAssignments WHERE id = ? AND userId = ?",
    )
    .bind(assignmentId, userId)
    .first<{ questionId: string; weekId: string }>();
  if (!a) return; // not this user's assignment (or unknown) — ignore, don't fail the flow
  // Not filtered to isActive: an assignment made while a question was active
  // must still be answerable after it's later deactivated, or the answer
  // silently fails to save and the assignment loops forever unanswered.
  const q = await db
    .prepare("SELECT pillarId FROM questions WHERE id = ?")
    .bind(a.questionId)
    .first<{ pillarId: PillarId }>();
  if (!q) return;

  const activeWeek = await getActiveWeekId(db);
  const isRetrospective = a.weekId !== activeWeek;
  const employmentId = await getActiveEmploymentId(db, userId);
  const id = `ci-${a.weekId}-${a.questionId}-${userId}`;
  await db
    .prepare(
      `INSERT OR REPLACE INTO checkIns
         (id, userId, questionId, pillarId, weekId, score, isRetrospective, employmentId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, userId, a.questionId, q.pillarId, a.weekId, score, isRetrospective ? 1 : 0, employmentId)
    .run();
  await db
    .prepare("UPDATE checkInAssignments SET status = 'answered' WHERE id = ?")
    .bind(assignmentId)
    .run();

  if (!isRetrospective) await bumpStreak(db, userId, a.weekId);
}

/**
 * "Skip this for now" on a catch-up question: mark the assignment skipped so it
 * drops off the pending list without recording a score. Only the owner's own
 * still-pending assignments can be skipped. Own data only.
 */
export async function skipCheckIn(
  session: SessionUser,
  userId: string,
  assignmentId: string,
): Promise<void> {
  assertOwner(session, userId);
  const db = getDB();
  await db
    .prepare(
      "UPDATE checkInAssignments SET status = 'skipped' WHERE id = ? AND userId = ? AND status = 'pending'",
    )
    .bind(assignmentId, userId)
    .run();
}

/**
 * Advance the streak once per window on a fresh check-in. Simplified for this
 * slice: no gap-reset yet (a missed week doesn't reset the count) — that lands
 * when the weekly roll-over job is built.
 */
async function bumpStreak(db: DB, userId: string, week: string): Promise<void> {
  const s = await db
    .prepare("SELECT currentStreak, longestStreak, lastCheckInWeek FROM streaks WHERE userId = ?")
    .bind(userId)
    .first<{ currentStreak: number; longestStreak: number; lastCheckInWeek: string | null }>();
  if (!s) {
    await db
      .prepare(
        "INSERT INTO streaks (userId, currentStreak, longestStreak, lastCheckInWeek) VALUES (?, 1, 1, ?)",
      )
      .bind(userId, week)
      .run();
    return;
  }
  if (s.lastCheckInWeek === week) return; // already counted this window
  const next = s.currentStreak + 1;
  const longest = Math.max(next, s.longestStreak);
  await db
    .prepare(
      "UPDATE streaks SET currentStreak = ?, longestStreak = ?, lastCheckInWeek = ? WHERE userId = ?",
    )
    .bind(next, longest, week, userId)
    .run();
}

/** The most recent check-in this user answered, for the Inbox. Own data only. */
export async function getLatestCheckIn(
  session: SessionUser,
  userId: string,
): Promise<LatestCheckIn | null> {
  assertOwner(session, userId);
  const db = getDB();
  const row = await db
    .prepare(
      `SELECT c.questionId AS questionId, c.score AS score, c.pillarId AS pillarId,
              c.weekId AS weekId, q.text AS questionText
         FROM checkIns c
         JOIN questions q ON q.id = c.questionId
        WHERE c.userId = ?
        ORDER BY c.timestamp DESC, c.weekId DESC
        LIMIT 1`,
    )
    .bind(userId)
    .first<{ questionId: string; score: number; pillarId: PillarId; weekId: string; questionText: string }>();
  if (!row) return null;
  const isLow = row.score < 7;
  const recommendation = isLow
    ? pickRecommendation(await loadRecommendations(), row.questionId, row.pillarId)
    : null;
  return {
    questionText: row.questionText,
    pillarId: row.pillarId,
    score: row.score,
    isLow,
    recommendation,
    dateLabel: await weekLabel(db, row.weekId),
  };
}

/**
 * The single oldest-still-open low-score recommendation to follow up on: the most
 * recent check-in with score < 7 that the user hasn't told us they acted on yet
 * (followUpStatus IS NULL). Own data only.
 */
export async function getOpenRecommendation(
  session: SessionUser,
  userId: string,
): Promise<OpenRecommendation | null> {
  assertOwner(session, userId);
  const db = getDB();
  const row = await db
    .prepare(
      `SELECT c.questionId AS questionId, c.pillarId AS pillarId, c.weekId AS weekId, q.text AS questionText
         FROM checkIns c JOIN questions q ON q.id = c.questionId
        WHERE c.userId = ? AND c.score < 7 AND c.followUpStatus IS NULL
        ORDER BY c.timestamp DESC, c.weekId DESC
        LIMIT 1`,
    )
    .bind(userId)
    .first<{ questionId: string; pillarId: PillarId; weekId: string; questionText: string }>();
  if (!row) return null;
  return {
    questionId: row.questionId,
    pillarId: row.pillarId,
    questionText: row.questionText,
    recommendation: pickRecommendation(await loadRecommendations(), row.questionId, row.pillarId),
    weekLabel: await weekLabel(db, row.weekId),
  };
}

/** Days between return check-ins — it should feel like a gentle nudge, not a nag. */
const RETURN_CHECKIN_COOLDOWN_DAYS = 2;

/**
 * The return check-in to show right now — the open recommendation from
 * getOpenRecommendation, but only if the user hasn't answered a return check-in
 * within the last couple of days (so it appears at most once every
 * RETURN_CHECKIN_COOLDOWN_DAYS rather than on every app open). Own data only.
 */
export async function getReturnCheckIn(
  session: SessionUser,
  userId: string,
): Promise<OpenRecommendation | null> {
  assertOwner(session, userId);
  const db = getDB();
  const recent = await db
    .prepare(
      `SELECT 1 AS x FROM checkIns
        WHERE userId = ? AND followUpAt IS NOT NULL
          AND followUpAt > datetime('now', ?)
        LIMIT 1`,
    )
    .bind(userId, `-${RETURN_CHECKIN_COOLDOWN_DAYS} days`)
    .first<{ x: number }>();
  if (recent) return null; // answered one within the cooldown window — hold off
  return getOpenRecommendation(session, userId);
}

/**
 * ALL of the user's open (un-actioned) low-score recommendations — unlike
 * getOpenRecommendation (singular, oldest-first, used to gate the return
 * check-in), this is the full list for the Inbox so every pending recommendation
 * can be acted on there, not just one at a time. Deduped to the most recent open
 * check-in per question (the same row submitFollowUp would resolve to for that
 * question), newest first. Own data only.
 */
export async function getOpenRecommendations(
  session: SessionUser,
  userId: string,
): Promise<OpenRecommendationItem[]> {
  assertOwner(session, userId);
  const db = getDB();
  const { results } = await db
    .prepare(
      `SELECT c.questionId AS questionId, c.pillarId AS pillarId, c.weekId AS weekId, q.text AS questionText
         FROM checkIns c JOIN questions q ON q.id = c.questionId
        WHERE c.userId = ? AND c.score < 7 AND c.followUpStatus IS NULL
          AND c.id = (
            SELECT c2.id FROM checkIns c2
             WHERE c2.userId = c.userId AND c2.questionId = c.questionId
               AND c2.score < 7 AND c2.followUpStatus IS NULL
             ORDER BY c2.timestamp DESC, c2.weekId DESC LIMIT 1
          )
        ORDER BY c.timestamp DESC, c.weekId DESC`,
    )
    .bind(userId)
    .all<{ questionId: string; pillarId: PillarId; weekId: string; questionText: string }>();
  const recMap = await loadRecommendations();
  const out: OpenRecommendationItem[] = [];
  for (const r of results) {
    out.push({
      questionId: r.questionId,
      pillarId: r.pillarId,
      questionText: r.questionText,
      recommendation: pickRecommendation(recMap, r.questionId, r.pillarId),
      weekLabel: await weekLabel(db, r.weekId),
    });
  }
  return out;
}

/**
 * The user's own recommendation history — every low-score recommendation
 * they've already responded to (acted or not_acted), newest response first, for
 * the Inbox history space. Own data only.
 */
export async function getRecommendationHistory(
  session: SessionUser,
  userId: string,
): Promise<RecommendationHistoryItem[]> {
  assertOwner(session, userId);
  const db = getDB();
  const { results } = await db
    .prepare(
      `SELECT c.questionId AS questionId, c.pillarId AS pillarId, c.weekId AS weekId,
              c.followUpStatus AS status, c.followUpAt AS followUpAt, q.text AS questionText
         FROM checkIns c JOIN questions q ON q.id = c.questionId
        WHERE c.userId = ? AND c.score < 7 AND c.followUpStatus IS NOT NULL
        ORDER BY COALESCE(c.followUpAt, c.timestamp) DESC
        LIMIT 20`,
    )
    .bind(userId)
    .all<{
      questionId: string;
      pillarId: PillarId;
      weekId: string;
      status: FollowUpStatus;
      followUpAt: string | null;
      questionText: string;
    }>();
  const recMap = await loadRecommendations();
  const out: RecommendationHistoryItem[] = [];
  for (const r of results) {
    out.push({
      questionId: r.questionId,
      pillarId: r.pillarId,
      questionText: r.questionText,
      recommendation: pickRecommendation(recMap, r.questionId, r.pillarId),
      status: r.status,
      weekLabel: await weekLabel(db, r.weekId),
      respondedAtLabel: dayLabel(r.followUpAt ?? ""),
    });
  }
  return out;
}

/**
 * The user's own follow-up reflections (the "what did you do" notes saved from a
 * return check-in), newest first, for the Inbox. Author-only — journal entries
 * are never shown to anyone else. Own data only.
 */
export async function getReflections(
  session: SessionUser,
  userId: string,
): Promise<Reflection[]> {
  assertOwner(session, userId);
  const db = getDB();
  const { results } = await db
    .prepare(
      `SELECT j.id AS id, j.text AS text, j.submittedAt AS submittedAt,
              q.text AS questionText, q.pillarId AS pillarId
         FROM journalEntries j
         LEFT JOIN questions q ON q.id = j.questionId
        WHERE j.userId = ? AND j.type = 'follow_up'
        ORDER BY j.submittedAt DESC
        LIMIT 20`,
    )
    .bind(userId)
    .all<{
      id: string;
      text: string;
      submittedAt: string;
      questionText: string | null;
      pillarId: PillarId | null;
    }>();
  return results.map((r) => ({
    id: r.id,
    text: r.text,
    dateLabel: dayLabel(r.submittedAt),
    pillarId: r.pillarId,
    questionText: r.questionText,
  }));
}

/** "2026-08-06 10:12:00" → "6 Aug 2026" for a reflection's date line. */
function dayLabel(ts: string): string {
  const datePart = (ts || "").slice(0, 10);
  const [y, m, d] = datePart.split("-");
  const mi = Number(m) - 1;
  return MONTHS[mi] ? `${Number(d)} ${MONTHS[mi].slice(0, 3)} ${y}` : datePart;
}

/**
 * Record whether the user acted on a past recommendation. Sets followUpStatus on
 * the matching low-score check-in; "acted" with a note also saves a private
 * journal entry (author-only). Own data only.
 */
export async function submitFollowUp(
  session: SessionUser,
  userId: string,
  input: { questionId: string; pillarId: PillarId; status: FollowUpStatus; journalText?: string },
): Promise<void> {
  assertOwner(session, userId);
  const db = getDB();
  const target = await db
    .prepare(
      `SELECT id, weekId FROM checkIns
        WHERE userId = ? AND questionId = ? AND score < 7 AND followUpStatus IS NULL
        ORDER BY timestamp DESC, weekId DESC LIMIT 1`,
    )
    .bind(userId, input.questionId)
    .first<{ id: string; weekId: string }>();
  if (!target) return;

  await db
    .prepare("UPDATE checkIns SET followUpStatus = ?, followUpAt = datetime('now') WHERE id = ?")
    .bind(input.status, target.id)
    .run();

  if (input.status === "acted" && input.journalText?.trim()) {
    await db
      .prepare(
        "INSERT INTO journalEntries (id, userId, weekId, questionId, text, type) VALUES (?, ?, ?, ?, ?, 'follow_up')",
      )
      .bind(`je-${crypto.randomUUID().slice(0, 8)}`, userId, target.weekId, input.questionId, input.journalText.trim())
      .run();
  }
}
