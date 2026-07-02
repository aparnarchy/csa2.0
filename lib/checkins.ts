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
import { getSampleRecommendation } from "./data";
import type { CheckInQuestion, LatestCheckIn, OpenRecommendation } from "./data";
import type { FollowUpStatus, PillarId, SessionUser } from "./types";

interface QuestionRow {
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

function toCheckInQuestion(q: QuestionRow): CheckInQuestion {
  return {
    id: q.id,
    text: q.text,
    pillarId: q.pillarId,
    options: [
      { key: "A", text: q.optionA_text, score: q.optionA_score },
      { key: "B", text: q.optionB_text, score: q.optionB_score },
      { key: "C", text: q.optionC_text, score: q.optionC_score },
    ],
  };
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

/** Active questions this user hasn't answered in the current window. Own data only. */
export async function getDueCheckIns(
  session: SessionUser,
  userId: string,
): Promise<CheckInQuestion[]> {
  assertOwner(session, userId);
  const db = getDB();
  const week = await getActiveWeekId(db);
  if (!week) return [];
  const { results } = await db
    .prepare(
      `SELECT id, text, pillarId,
              optionA_text, optionA_score, optionB_text, optionB_score, optionC_text, optionC_score
         FROM questions
        WHERE isActive = 1
          AND id NOT IN (SELECT questionId FROM checkIns WHERE userId = ? AND weekId = ?)
        ORDER BY id`,
    )
    .bind(userId, week)
    .all<QuestionRow>();
  return results.map(toCheckInQuestion);
}

/**
 * Questions missed in previous weeks. There is no skipped-question tracking yet,
 * so there is nothing to catch up on — returns []. (Real roll-over lands with the
 * skip feature.) Own data only.
 */
export async function getUnansweredCheckIns(
  session: SessionUser,
  userId: string,
): Promise<CheckInQuestion[]> {
  assertOwner(session, userId);
  return [];
}

/**
 * Record one answer for the current window. Idempotent: the row id is derived
 * from (week, question, user), so re-answering updates the score rather than
 * duplicating. Unknown/inactive questions are ignored (no FK crash). A fresh
 * (non-retrospective) answer advances the weekly streak. Own data only.
 */
export async function submitCheckIn(
  session: SessionUser,
  userId: string,
  questionId: string,
  score: number,
  isRetrospective = false,
): Promise<void> {
  assertOwner(session, userId);
  const db = getDB();
  const q = await db
    .prepare("SELECT pillarId FROM questions WHERE id = ? AND isActive = 1")
    .bind(questionId)
    .first<{ pillarId: PillarId }>();
  if (!q) return; // unknown/inactive question — ignore rather than fail the flow
  const week = await getActiveWeekId(db);
  if (!week) return;
  const employmentId = await getActiveEmploymentId(db, userId);
  const id = `ci-${week}-${questionId}-${userId}`;
  await db
    .prepare(
      `INSERT OR REPLACE INTO checkIns
         (id, userId, questionId, pillarId, weekId, score, isRetrospective, employmentId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, userId, questionId, q.pillarId, week, score, isRetrospective ? 1 : 0, employmentId)
    .run();

  if (!isRetrospective) await bumpStreak(db, userId, week);
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
      `SELECT c.score AS score, c.pillarId AS pillarId, c.weekId AS weekId, q.text AS questionText
         FROM checkIns c
         JOIN questions q ON q.id = c.questionId
        WHERE c.userId = ?
        ORDER BY c.timestamp DESC, c.weekId DESC
        LIMIT 1`,
    )
    .bind(userId)
    .first<{ score: number; pillarId: PillarId; weekId: string; questionText: string }>();
  if (!row) return null;
  const isLow = row.score < 7;
  return {
    questionText: row.questionText,
    pillarId: row.pillarId,
    score: row.score,
    isLow,
    recommendation: isLow ? getSampleRecommendation(row.pillarId).text : null,
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
    recommendation: getSampleRecommendation(row.pillarId).text,
    weekLabel: await weekLabel(db, row.weekId),
  };
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
    .prepare("UPDATE checkIns SET followUpStatus = ? WHERE id = ?")
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
