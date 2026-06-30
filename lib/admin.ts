/**
 * Admin data layer (Phase 4.4) — real D1 reads/writes for the admin panel.
 *
 * This is the app's first feature surface that writes to the database, so the
 * pattern lives here: every function takes the caller's session and guards with
 * `assertRole(session, "admin")` BEFORE touching D1. Privacy/authorisation is
 * enforced in server code, never in the UI.
 */

import { getDB } from "@/lib/db";
import { assertRole } from "@/lib/access-control";
import type { PillarId, Question, SessionUser } from "@/lib/types";

/** The editable fields of a question (everything except its id). */
export interface QuestionInput {
  text: string;
  pillarId: PillarId;
  optionA_text: string;
  optionA_score: number;
  optionB_text: string;
  optionB_score: number;
  optionC_text: string;
  optionC_score: number;
  isActive: boolean;
}

interface QuestionRow {
  id: string;
  text: string;
  pillarId: PillarId;
  optionA_text: string;
  optionA_score: number;
  optionB_text: string;
  optionB_score: number;
  optionC_text: string;
  optionC_score: number;
  isActive: number;
}

function rowToQuestion(r: QuestionRow): Question {
  return { ...r, isActive: r.isActive === 1 };
}

/** Fixed pillar order so the bank lists consistently (matches the dashboards). */
const PILLAR_RANK: Record<PillarId, number> = {
  meaningful_work: 0,
  growth: 1,
  culture: 2,
  compensation: 3,
};

/** All questions, grouped-friendly: ordered by pillar, then id. Admin only. */
export async function listQuestions(session: SessionUser): Promise<Question[]> {
  assertRole(session, "admin");
  const db = getDB();
  const { results } = await db
    .prepare("SELECT * FROM questions")
    .all<QuestionRow>();
  return results
    .map(rowToQuestion)
    .sort((a, b) => PILLAR_RANK[a.pillarId] - PILLAR_RANK[b.pillarId] || a.id.localeCompare(b.id));
}

/** Validate the A/B/C mapping and required text. Throws on bad input. */
function validate(input: QuestionInput): void {
  if (!input.text.trim()) throw new Error("Question text is required.");
  for (const [label, text, score] of [
    ["A", input.optionA_text, input.optionA_score],
    ["B", input.optionB_text, input.optionB_score],
    ["C", input.optionC_text, input.optionC_score],
  ] as const) {
    if (!String(text).trim()) throw new Error(`Option ${label} text is required.`);
    if (!Number.isInteger(score) || score < 0 || score > 10) {
      throw new Error(`Option ${label} score must be a whole number from 0 to 10.`);
    }
  }
}

/** Insert a new question and return it. Admin only. */
export async function createQuestion(
  session: SessionUser,
  input: QuestionInput,
): Promise<Question> {
  assertRole(session, "admin");
  validate(input);
  const id = `q-${crypto.randomUUID().slice(0, 8)}`;
  const db = getDB();
  await db
    .prepare(
      `INSERT INTO questions
         (id, text, pillarId, optionA_text, optionA_score, optionB_text, optionB_score,
          optionC_text, optionC_score, isActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.text.trim(),
      input.pillarId,
      input.optionA_text.trim(),
      input.optionA_score,
      input.optionB_text.trim(),
      input.optionB_score,
      input.optionC_text.trim(),
      input.optionC_score,
      input.isActive ? 1 : 0,
    )
    .run();
  return { id, ...input };
}

/** Update an existing question by id and return it. Admin only. */
export async function updateQuestion(
  session: SessionUser,
  id: string,
  input: QuestionInput,
): Promise<Question> {
  assertRole(session, "admin");
  validate(input);
  const db = getDB();
  await db
    .prepare(
      `UPDATE questions SET
         text = ?, pillarId = ?, optionA_text = ?, optionA_score = ?,
         optionB_text = ?, optionB_score = ?, optionC_text = ?, optionC_score = ?,
         isActive = ?
       WHERE id = ?`,
    )
    .bind(
      input.text.trim(),
      input.pillarId,
      input.optionA_text.trim(),
      input.optionA_score,
      input.optionB_text.trim(),
      input.optionB_score,
      input.optionC_text.trim(),
      input.optionC_score,
      input.isActive ? 1 : 0,
      id,
    )
    .run();
  return { id, ...input };
}

/** Permanently remove a question. Admin only. */
export async function deleteQuestion(session: SessionUser, id: string): Promise<void> {
  assertRole(session, "admin");
  const db = getDB();
  await db.prepare("DELETE FROM questions WHERE id = ?").bind(id).run();
}
