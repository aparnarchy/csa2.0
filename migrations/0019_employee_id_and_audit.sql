-- 1. Employee ID: the company's own permanent id for a person's job. Lives on
--    the job (employment), not the lifelong person, and on a pending invite
--    until that person signs up. Unique among current jobs, so an upload can
--    match people by it even after their email changes. (Becomes unique per
--    organisation once multi-org lands.)
ALTER TABLE employment ADD COLUMN employeeId TEXT;
ALTER TABLE invites ADD COLUMN employeeId TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_employment_active_employeeId
  ON employment(employeeId) WHERE employeeId IS NOT NULL AND status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_pending_employeeId
  ON invites(employeeId) WHERE employeeId IS NOT NULL AND status = 'pending';

-- 2. Admin audit log: who changed what, when (status, roles, edits, deletes,
--    uploads). Append-only; `detail` is a small JSON blob of before/after.
CREATE TABLE IF NOT EXISTS adminAuditLog (
  id TEXT PRIMARY KEY,
  actorId TEXT NOT NULL,
  action TEXT NOT NULL,
  targetType TEXT NOT NULL,
  targetId TEXT,
  detail TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_adminAuditLog_createdAt ON adminAuditLog(createdAt);
