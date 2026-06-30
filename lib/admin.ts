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
import type { Department, PillarId, Question, SessionUser, Team } from "@/lib/types";

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

// ─────────────────────────────────────────────────────────────────────────────
// Org structure: departments, teams, and assignments (Phase 4.4)
// ─────────────────────────────────────────────────────────────────────────────

/** A manager option for the team-assignment dropdown. */
export interface ManagerOption {
  id: string;
  name: string;
  email: string;
}

/** The whole org tree the admin screen needs, in one round-trip. Admin only. */
export interface OrgStructure {
  departments: Department[];
  teams: Team[];
  managers: ManagerOption[];
}

interface TeamRow {
  id: string;
  name: string;
  managerId: string | null;
  departmentId: string | null;
}

export async function getOrgStructure(session: SessionUser): Promise<OrgStructure> {
  assertRole(session, "admin");
  const db = getDB();
  const [depts, teams, mgrs] = await Promise.all([
    db.prepare("SELECT id, name FROM departments ORDER BY name").all<Department>(),
    db.prepare("SELECT id, name, managerId, departmentId FROM teams ORDER BY name").all<TeamRow>(),
    db
      .prepare(
        `SELECT u.id, u.name, u.email FROM user u
           JOIN user_roles ur ON ur.userId = u.id
          WHERE ur.role = 'manager' ORDER BY u.name`,
      )
      .all<ManagerOption>(),
  ]);
  return {
    departments: depts.results,
    teams: teams.results,
    managers: mgrs.results,
  };
}

export async function createDepartment(session: SessionUser, name: string): Promise<void> {
  assertRole(session, "admin");
  if (!name.trim()) throw new Error("Department name is required.");
  const id = `dept-${crypto.randomUUID().slice(0, 8)}`;
  await getDB().prepare("INSERT INTO departments (id, name) VALUES (?, ?)").bind(id, name.trim()).run();
}

export async function updateDepartment(
  session: SessionUser,
  id: string,
  name: string,
): Promise<void> {
  assertRole(session, "admin");
  if (!name.trim()) throw new Error("Department name is required.");
  await getDB().prepare("UPDATE departments SET name = ? WHERE id = ?").bind(name.trim(), id).run();
}

/** Delete a department; any teams in it become unassigned (departmentId → null). */
export async function deleteDepartment(session: SessionUser, id: string): Promise<void> {
  assertRole(session, "admin");
  const db = getDB();
  await db.batch([
    db.prepare("UPDATE teams SET departmentId = NULL WHERE departmentId = ?").bind(id),
    db.prepare("DELETE FROM departments WHERE id = ?").bind(id),
  ]);
}

/** The editable fields of a team. */
export interface TeamInput {
  name: string;
  departmentId: string | null;
  managerId: string | null;
}

export async function createTeam(session: SessionUser, input: TeamInput): Promise<void> {
  assertRole(session, "admin");
  if (!input.name.trim()) throw new Error("Team name is required.");
  const id = `team-${crypto.randomUUID().slice(0, 8)}`;
  await getDB()
    .prepare("INSERT INTO teams (id, name, managerId, departmentId) VALUES (?, ?, ?, ?)")
    .bind(id, input.name.trim(), input.managerId || null, input.departmentId || null)
    .run();
}

export async function updateTeam(
  session: SessionUser,
  id: string,
  input: TeamInput,
): Promise<void> {
  assertRole(session, "admin");
  if (!input.name.trim()) throw new Error("Team name is required.");
  await getDB()
    .prepare("UPDATE teams SET name = ?, managerId = ?, departmentId = ? WHERE id = ?")
    .bind(input.name.trim(), input.managerId || null, input.departmentId || null, id)
    .run();
}

export async function deleteTeam(session: SessionUser, id: string): Promise<void> {
  assertRole(session, "admin");
  await getDB().prepare("DELETE FROM teams WHERE id = ?").bind(id).run();
}
