-- Close a few real data-integrity gaps found in the Admin section: nothing at
-- the database level stopped two pending invites for the same email (only an
-- application-level check, which a race could slip past), or two departments/
-- teams being created with the identical name.

-- Only one PENDING invite per email at a time (a partial index, not a plain
-- UNIQUE(email), because re-inviting someone whose earlier invite was already
-- accepted is legitimate and shouldn't be blocked).
CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_pending_email
  ON invites (lower(email))
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_name
  ON departments (name COLLATE NOCASE);

CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_name
  ON teams (name COLLATE NOCASE);
