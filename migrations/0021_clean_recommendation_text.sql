-- One-time tidy of recommendation text pasted from Google Docs (owner-approved
-- 2026-10-14). Wording is unchanged; only invisible characters and typos:
--   * soft line breaks (vertical tab, char 11) -> real line breaks, so
--     sentences stop running together ("on it.This week")
--   * zero-width spaces (char 8203) removed
--   * doubled spaces -> single
--   * "from you manager" -> "from your manager"
-- New text saved in Admin is cleaned the same way (cleanPastedText, lib/admin.ts).
UPDATE recommendations SET text = replace(text, char(11), char(10));
UPDATE recommendations SET text = replace(text, char(8203), '');
UPDATE recommendations SET text = replace(text, '  ', ' ') WHERE text LIKE '%  %';
UPDATE recommendations SET text = replace(text, '  ', ' ') WHERE text LIKE '%  %';
UPDATE recommendations SET text = replace(text, ' ' || char(10), char(10));
UPDATE recommendations SET text = replace(text, char(10) || ' ', char(10));
UPDATE recommendations SET text = replace(text, 'from you manager', 'from your manager');
UPDATE recommendations SET text = trim(text);
