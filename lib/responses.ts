/**
 * The "how was this question answered" breakdown under a Strengths / Concerns
 * row (and on manager Inbox actions) — one rule for every view, always using
 * the question's REAL option wording:
 *
 *  - An individual (employee dashboard): the three options with their most
 *    recent pick highlighted, plus how many times they've answered it.
 *  - A group (team / department / company / manager Inbox):
 *      SPLIT_MIN_PEOPLE or more people → the % who picked each option;
 *      fewer → only the average and the option it's closest to, no
 *      percentages, so a small team's split can't point at one person.
 */
import { SPLIT_MIN_PEOPLE } from "./scoring";

export type OptionKey = "A" | "B" | "C";

export interface ResponseOption {
  key: OptionKey;
  text: string;
  /** % of people who picked it — only meaningful for a "split" breakdown. */
  pct: number;
}

export type Breakdown =
  | { kind: "mine"; pickedKey: OptionKey | null; timesAnswered: number }
  | { kind: "split"; people: number }
  | { kind: "average"; closestKey: OptionKey; people: number };

/** The option columns every question row carries. */
export interface QuestionOptionCols {
  optionA_text: string;
  optionA_score: number;
  optionB_text: string;
  optionB_score: number;
  optionC_text: string;
  optionC_score: number;
}

function optionsOf(q: QuestionOptionCols) {
  return [
    { key: "A" as const, text: q.optionA_text, score: q.optionA_score },
    { key: "B" as const, text: q.optionB_text, score: q.optionB_score },
    { key: "C" as const, text: q.optionC_text, score: q.optionC_score },
  ];
}

/** The option whose score is nearest `score` (a tie goes to the lower one). */
function closestKey(q: QuestionOptionCols, score: number): OptionKey {
  return [...optionsOf(q)].sort(
    (a, b) => Math.abs(a.score - score) - Math.abs(b.score - score) || a.score - b.score,
  )[0].key;
}

/** One person's own answers to a question, oldest first. */
export function myBreakdown(
  q: QuestionOptionCols,
  answersOldestFirst: number[],
): { responses: ResponseOption[]; breakdown: Breakdown } {
  const latest = answersOldestFirst[answersOldestFirst.length - 1];
  return {
    responses: optionsOf(q).map(({ key, text }) => ({ key, text, pct: 0 })),
    breakdown: {
      kind: "mine",
      // closestKey, not an exact match, so an answer saved before an admin
      // re-scored the options still highlights something sensible.
      pickedKey: latest === undefined ? null : closestKey(q, latest),
      timesAnswered: answersOldestFirst.length,
    },
  };
}

/** A group's answers to a question; `people` = distinct people behind `scores`. */
export function groupBreakdown(
  q: QuestionOptionCols,
  scores: number[],
  people: number,
): { responses: ResponseOption[]; breakdown: Breakdown } {
  const opts = optionsOf(q);
  if (people >= SPLIT_MIN_PEOPLE) {
    const total = scores.length || 1;
    return {
      responses: opts.map(({ key, text, score }) => ({
        key,
        text,
        pct: Math.round((scores.filter((s) => s === score).length / total) * 100),
      })),
      breakdown: { kind: "split", people },
    };
  }
  const average = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
  return {
    responses: opts.map(({ key, text }) => ({ key, text, pct: 0 })),
    breakdown: { kind: "average", closestKey: closestKey(q, average), people },
  };
}
