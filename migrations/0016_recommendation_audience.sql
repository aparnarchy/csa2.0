-- Recommendations need separate text per audience: the employee reading their
-- own low score, and the manager coaching a team member on it. The table only
-- ever had one text slot, which worked while only one had been written — now
-- that both an employee-facing and manager-facing version are being uploaded,
-- one would silently overwrite the other without this.
ALTER TABLE recommendations ADD COLUMN audience TEXT NOT NULL DEFAULT 'employee' CHECK(audience IN ('employee','manager'));

-- Existing rows (all authored before this split) become the employee copy —
-- that is the audience every one of them was actually written for so far.
