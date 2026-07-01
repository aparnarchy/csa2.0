-- Phase 4.5 groundwork: separate the lifelong PERSON (user) from time-bounded
-- EMPLOYMENT. Adds the employment + workEmailLinks tables, scopes check-ins to an
-- employment, backfills one active employment per existing user, and removes the
-- cancelled mentor fields.
--
-- STAGED: the existing job columns on `user`
-- (teamId/managerId/departmentId/currentCompany/currentRole) are KEPT for now as
-- a cache of the person's active employment, so today's screens keep working.
-- They are retired in a later (Phase B) migration once team aggregation reads
-- from `employment` directly.

-- 1. Employment: one row per job at one company for a span of time.
--    userId NULL = an un-claimed roster row (created by a bulk upload) waiting to
--    be attached to a person via the verified work-email flow.
CREATE TABLE IF NOT EXISTS employment (
  id TEXT PRIMARY KEY,
  userId TEXT,
  companyName TEXT,
  departmentId TEXT,
  teamId TEXT,
  managerId TEXT,
  designation TEXT,
  workEmail TEXT,
  workEmailVerified INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','ended')),
  startedAt TEXT,
  endedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_employment_userId ON employment(userId);
CREATE INDEX IF NOT EXISTS idx_employment_workEmail ON employment(workEmail);

-- 2. Double opt-in work-email verification tokens. A logged-in person adds a
--    work email; a link is sent to it; clicking it attaches the matching pending
--    employment row to the person. (Email send stubbed until the Resend key.)
CREATE TABLE IF NOT EXISTS workEmailLinks (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  workEmail TEXT NOT NULL,
  token TEXT NOT NULL,
  employmentId TEXT,
  expiresAt TEXT NOT NULL,
  consumedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workemaillinks_token ON workEmailLinks(token);

-- 3. Scope check-ins to the employment they were made under, so future team
--    rollups only count check-ins made while a person was active on that team.
ALTER TABLE checkIns ADD COLUMN employmentId TEXT;

-- 4. Backfill: give every existing person who has any job info one ACTIVE
--    employment. For these pre-migration rows the signup email doubles as the
--    work email (there was no separate personal/work split before).
INSERT INTO employment
  (id, userId, companyName, departmentId, teamId, managerId, designation,
   workEmail, workEmailVerified, status, startedAt, createdAt)
SELECT
  'emp-' || substr(lower(hex(randomblob(4))), 1, 8),
  id,
  currentCompany,
  departmentId,
  teamId,
  managerId,
  currentRole,
  email,
  1,
  'active',
  datetime('now'),
  datetime('now')
FROM user
WHERE teamId IS NOT NULL
   OR managerId IS NOT NULL
   OR departmentId IS NOT NULL
   OR currentCompany IS NOT NULL
   OR currentRole IS NOT NULL;

-- 5. Remove the cancelled mentor fields. This data is intentionally discarded.
ALTER TABLE user DROP COLUMN mentorName;
ALTER TABLE user DROP COLUMN mentorEmail;
