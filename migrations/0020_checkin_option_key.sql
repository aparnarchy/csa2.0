-- Which answer option (A/B/C, as stored in the question bank) a check-in picked.
-- Options are shown shuffled and without letters, so the tag is saved alongside
-- the score: the score drives every aggregate, the tag says exactly which
-- option it came from regardless of the order it was displayed in.
ALTER TABLE checkIns ADD COLUMN optionKey TEXT CHECK(optionKey IN ('A','B','C'));

-- Past answers: recover the tag from the score where it matches exactly one of
-- the question's options. Ambiguous or unmatched scores stay NULL (score untouched).
UPDATE checkIns SET optionKey = (
  SELECT CASE
    WHEN checkIns.score = q.optionA_score AND checkIns.score <> q.optionB_score AND checkIns.score <> q.optionC_score THEN 'A'
    WHEN checkIns.score = q.optionB_score AND checkIns.score <> q.optionA_score AND checkIns.score <> q.optionC_score THEN 'B'
    WHEN checkIns.score = q.optionC_score AND checkIns.score <> q.optionA_score AND checkIns.score <> q.optionB_score THEN 'C'
  END
  FROM questions q WHERE q.id = checkIns.questionId
)
WHERE optionKey IS NULL;
