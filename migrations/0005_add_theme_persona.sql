-- Per-user look & feel preferences.
--   themeMode: design only — 'professional' (serious) or 'play' (fun look).
--   persona:   under Play, drives the voice/copy — 'spiderman' or 'batman'.
-- New users default to the safe professional view; switching to Play defaults
-- to spiderman. Both are freely switchable any time.
ALTER TABLE user ADD COLUMN themeMode TEXT NOT NULL DEFAULT 'professional';
ALTER TABLE user ADD COLUMN persona TEXT NOT NULL DEFAULT 'spiderman';
