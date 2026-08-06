-- Check-in assignments (Phase: real scheduled check-in delivery).
--
-- The spec is "2 check-in questions per week, delivered on random working days,
-- 9am-6pm only" plus a way to see questions still pending from previous weeks.
-- Neither was possible before: `getDueCheckIns` just handed back every active
-- question at once, and `getUnansweredCheckIns` was stubbed to []. There was no
-- record of "this question was given to this user this week and is still open".
--
-- This table is that record. The scheduler (lib/scheduler.ts) writes exactly two
-- rows per user per week, each with a randomised `releaseAt` inside that week's
-- working hours. A question is only "due" once releaseAt has passed and it's
-- still `pending`. Answering flips it to `answered`; skipping to `skipped`.
--
--   status:    pending  -> released or not-yet-released, unanswered (the default)
--              answered -> the user submitted a check-in for it
--              skipped  -> the user chose "skip this for now" on a catch-up
--
-- weekId + questionId + userId are unique together (one assignment of a given
-- question to a user in a given week), which is also how the id is derived so
-- generation stays idempotent (INSERT OR IGNORE re-running the scheduler is safe).

CREATE TABLE IF NOT EXISTS checkInAssignments (
  id           TEXT PRIMARY KEY,          -- asg-<weekId>-<userId>-<questionId>
  userId       TEXT NOT NULL,
  questionId   TEXT NOT NULL,
  weekId       TEXT NOT NULL,
  releaseAt    TEXT NOT NULL,             -- 'YYYY-MM-DD HH:MM:SS' (UTC), compared with datetime('now')
  status       TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','answered','skipped')),
  createdAt    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (questionId) REFERENCES questions(id),
  FOREIGN KEY (weekId) REFERENCES weeklyWindows(weekId),
  UNIQUE (userId, weekId, questionId)
);

-- The two hot read paths: "what's due for this user now" and "what's still
-- pending from earlier weeks", both filter by user + status + releaseAt.
CREATE INDEX IF NOT EXISTS idx_assign_user_status ON checkInAssignments (userId, status, releaseAt);
CREATE INDEX IF NOT EXISTS idx_assign_user_week   ON checkInAssignments (userId, weekId);
