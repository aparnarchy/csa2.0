-- Real D1 usage-cap issue found 2026-09-10: `checkIns` (the single busiest
-- table in the app — every dashboard aggregate reads it) has never had an
-- index on any of its foreign keys, including `employmentId`, the exact
-- column every team/department/org aggregate query JOINs employment on.
-- Every one of those queries has been doing a full table scan. Same problem
-- for `employment.teamId`/`departmentId`, which every one of those same
-- queries also filters on.

CREATE INDEX IF NOT EXISTS idx_checkins_employmentId ON checkIns (employmentId);
CREATE INDEX IF NOT EXISTS idx_checkins_userId        ON checkIns (userId);
CREATE INDEX IF NOT EXISTS idx_checkins_questionId    ON checkIns (questionId);
CREATE INDEX IF NOT EXISTS idx_checkins_weekId         ON checkIns (weekId);

CREATE INDEX IF NOT EXISTS idx_employment_teamId       ON employment (teamId, status);
CREATE INDEX IF NOT EXISTS idx_employment_departmentId ON employment (departmentId, status);
