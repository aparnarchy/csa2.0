-- Smart roster upload + manager approval.
--
-- 1. Invites carry the rest of a roster row: the person's name, grade and
--    department, plus whether an invite email actually went out. Uploads are
--    quiet by default (no mass email), and the email service can only deliver
--    to verified domains, so "was it emailed?" has to be recorded honestly
--    rather than assumed.
ALTER TABLE invites ADD COLUMN name TEXT;
ALTER TABLE invites ADD COLUMN grade TEXT;
ALTER TABLE invites ADD COLUMN departmentId TEXT;
ALTER TABLE invites ADD COLUMN emailStatus TEXT NOT NULL DEFAULT 'not_sent'
  CHECK(emailStatus IN ('not_sent','sent','failed'));

-- 2. Grade lives on the job (employment), not the lifelong person.
ALTER TABLE employment ADD COLUMN grade TEXT;

-- 3. From now on an invite's team means "the team they're a MEMBER of", and
--    leading a team is recorded only on teams.pendingManagerEmail (approved by
--    an admin before it takes effect). Older manager invites meant "leads this
--    team", so convert those that are still pending: hand the team's lead
--    slot to them (only where the team has no manager yet) and drop the
--    membership, so they don't end up counted inside the team they lead.
UPDATE teams
   SET pendingManagerEmail = (
         SELECT lower(i.email) FROM invites i
          WHERE i.teamId = teams.id AND i.role = 'manager' AND i.status = 'pending'
          ORDER BY i.createdAt DESC LIMIT 1)
 WHERE managerId IS NULL
   AND pendingManagerEmail IS NULL
   AND EXISTS (SELECT 1 FROM invites i
                WHERE i.teamId = teams.id AND i.role = 'manager' AND i.status = 'pending');

UPDATE invites
   SET teamId = NULL
 WHERE role = 'manager' AND status = 'pending' AND teamId IS NOT NULL
   AND EXISTS (SELECT 1 FROM teams t
                WHERE t.id = invites.teamId AND lower(t.pendingManagerEmail) = lower(invites.email));
