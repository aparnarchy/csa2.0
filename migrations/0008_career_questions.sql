-- Career-history questionnaire (Phase: career tab).
--
-- Deliberately a SEPARATE table from `questions` (the weekly check-in bank).
-- These ask about a PAST company in the past tense; the check-in bank asks
-- about the current company right now. Keeping them apart means a career
-- question can never leak into a weekly check-in through a forgotten filter.
--
-- Shape mirrors `questions` (see 0001_initial_schema.sql) so the same
-- row -> UI mapper works for both.
--
-- `kind` records the Feeling/Data tag from the source sheet. Stored but not
-- yet used — it's there for later weighting or analysis.

CREATE TABLE IF NOT EXISTS careerQuestions (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  pillarId TEXT NOT NULL CHECK(pillarId IN ('meaningful_work','growth','culture','compensation')),
  optionA_text TEXT NOT NULL,
  optionA_score INTEGER NOT NULL,
  optionB_text TEXT NOT NULL,
  optionB_score INTEGER NOT NULL,
  optionC_text TEXT NOT NULL,
  optionC_score INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('feeling','data')),
  sortOrder INTEGER NOT NULL,
  isActive INTEGER NOT NULL DEFAULT 1
);

-- The 7 questions, in sheet order. Options run best -> worst, scored 10/7/4 —
-- the app's standard three-point scale, used identically by the weekly check-in
-- bank. Note the ORDER differs between the two tables: here A is the best
-- option, in `questions` A is the worst. The scores, not the letters, are what
-- carry the meaning.

INSERT OR REPLACE INTO careerQuestions
  (id, text, pillarId, optionA_text, optionA_score, optionB_text, optionB_score, optionC_text, optionC_score, kind, sortOrder)
VALUES
  ('cq1',
   'How did you find the work you did there?',
   'meaningful_work',
   'I enjoyed what I was doing/fulfillment/value - majority of the time', 10,
   'It was a mixed bag - some of it mattered, some didn''t', 7,
   'It was just a job', 4,
   'feeling', 1),

  ('cq2',
   'In a typical 6-month stretch there, how many projects gave you the feeling of "I''ve accomplished it"?',
   'meaningful_work',
   '3 or more', 10,
   '1-2', 7,
   'None', 4,
   'data', 2),

  ('cq3',
   'Do you think people in your team care about you as a person?',
   'culture',
   'Yes I felt genuinely cared for', 10,
   'I was treated nicely but nothing special', 7,
   'Not really, it was more of a formal relationship', 4,
   'feeling', 3),

  ('cq4',
   'If a friend has an offer from there, what would you say?',
   'culture',
   'Would whole heartedly recommend they take it', 10,
   'Ask them to do their due diligence', 7,
   'I''d have advised them against it', 4,
   'feeling', 4),

  ('cq5',
   'Did you feel comfortable disagreeing openly with the team?',
   'culture',
   'It was normal to disagree openly', 10,
   'Sometimes, only when it really mattered', 7,
   'Almost never — it wasn''t worth it', 4,
   'data', 5),

  ('cq6',
   'How were the opportunities for growth there?',
   'growth',
   'There were plenty of opportunities', 10,
   'It was decent/acceptable', 7,
   'They were very limited', 4,
   'feeling', 6),

  ('cq7',
   'How was your compensation?',
   'compensation',
   'Felt it was fair', 10,
   'It was average, could''ve been better', 7,
   'I felt undervalued', 4,
   'feeling', 7);
