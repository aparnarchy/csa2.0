-- Per-user notification preferences (Profile → Preferences). Both default to
-- on, matching the always-on UI shown before this was wired to real storage.
ALTER TABLE user ADD COLUMN remindersEnabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user ADD COLUMN weeklyDigestEnabled INTEGER NOT NULL DEFAULT 1;
