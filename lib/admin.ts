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
import type {
  ContentType,
  Department,
  PillarId,
  Question,
  SessionUser,
  Team,
  WisdomAudience,
  WisdomContent,
  WisdomLevel,
  WisdomModule,
} from "@/lib/types";

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

// ─────────────────────────────────────────────────────────────────────────────
// Wisdom content CMS: modules and their content items (Phase 4.4). Content items
// inherit their module's pillar / audience / level so the admin only sets them
// once. `isActive` is the publish switch.
// ─────────────────────────────────────────────────────────────────────────────

/** A module with its ordered content items. */
export interface WisdomModuleWithContent extends WisdomModule {
  content: WisdomContent[];
}

interface ModuleRow {
  id: string;
  title: string;
  pillarId: PillarId;
  audience: WisdomAudience;
  level: WisdomLevel;
  badgeAwarded: string | null;
  isActive: number;
}

interface ContentRow {
  id: string;
  moduleId: string;
  title: string;
  type: ContentType;
  pillarId: PillarId;
  audience: WisdomAudience;
  body: string | null;
  sortOrder: number;
  isActive: number;
  level: WisdomLevel;
  hasQuiz: number;
  quizQuestions: string | null;
}

const LEVEL_RANK: Record<WisdomLevel, number> = { beginner: 0, advanced: 1, expert: 2 };

export async function getWisdomCms(session: SessionUser): Promise<WisdomModuleWithContent[]> {
  assertRole(session, "admin");
  const db = getDB();
  const [mods, items] = await Promise.all([
    db.prepare("SELECT * FROM wisdomModules").all<ModuleRow>(),
    db.prepare("SELECT * FROM wisdomContent").all<ContentRow>(),
  ]);

  const byModule = new Map<string, WisdomContent[]>();
  for (const r of items.results) {
    const c: WisdomContent = {
      ...r,
      isActive: r.isActive === 1,
      hasQuiz: r.hasQuiz === 1,
      quizQuestions: r.quizQuestions ? JSON.parse(r.quizQuestions) : null,
    };
    const arr = byModule.get(r.moduleId) ?? [];
    arr.push(c);
    byModule.set(r.moduleId, arr);
  }

  return mods.results
    .map((m) => ({
      ...m,
      isActive: m.isActive === 1,
      content: (byModule.get(m.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .sort(
      (a, b) =>
        LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
        PILLAR_RANK[a.pillarId] - PILLAR_RANK[b.pillarId] ||
        a.title.localeCompare(b.title),
    );
}

export interface WisdomModuleInput {
  title: string;
  pillarId: PillarId;
  audience: WisdomAudience;
  level: WisdomLevel;
  badgeAwarded: string | null;
  isActive: boolean;
}

export async function createModule(session: SessionUser, input: WisdomModuleInput): Promise<void> {
  assertRole(session, "admin");
  if (!input.title.trim()) throw new Error("Module title is required.");
  const id = `wm-${crypto.randomUUID().slice(0, 8)}`;
  await getDB()
    .prepare(
      `INSERT INTO wisdomModules (id, title, pillarId, audience, level, badgeAwarded, isActive)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.title.trim(),
      input.pillarId,
      input.audience,
      input.level,
      input.badgeAwarded?.trim() || null,
      input.isActive ? 1 : 0,
    )
    .run();
}

export async function updateModule(
  session: SessionUser,
  id: string,
  input: WisdomModuleInput,
): Promise<void> {
  assertRole(session, "admin");
  if (!input.title.trim()) throw new Error("Module title is required.");
  const db = getDB();
  await db.batch([
    db
      .prepare(
        `UPDATE wisdomModules SET title=?, pillarId=?, audience=?, level=?, badgeAwarded=?, isActive=?
         WHERE id=?`,
      )
      .bind(
        input.title.trim(),
        input.pillarId,
        input.audience,
        input.level,
        input.badgeAwarded?.trim() || null,
        input.isActive ? 1 : 0,
        id,
      ),
    // keep content items aligned to the module's pillar / audience / level
    db
      .prepare("UPDATE wisdomContent SET pillarId=?, audience=?, level=? WHERE moduleId=?")
      .bind(input.pillarId, input.audience, input.level, id),
  ]);
}

/** Delete a module and all its content (content has ON DELETE CASCADE). */
export async function deleteModule(session: SessionUser, id: string): Promise<void> {
  assertRole(session, "admin");
  await getDB().prepare("DELETE FROM wisdomModules WHERE id = ?").bind(id).run();
}

export interface WisdomContentInput {
  title: string;
  type: ContentType;
  body: string | null;
  sortOrder: number;
  isActive: boolean;
}

export async function createContent(
  session: SessionUser,
  moduleId: string,
  input: WisdomContentInput,
): Promise<void> {
  assertRole(session, "admin");
  if (!input.title.trim()) throw new Error("Content title is required.");
  const db = getDB();
  const mod = await db
    .prepare("SELECT pillarId, audience, level FROM wisdomModules WHERE id = ?")
    .bind(moduleId)
    .first<{ pillarId: PillarId; audience: WisdomAudience; level: WisdomLevel }>();
  if (!mod) throw new Error("That module no longer exists.");
  const id = `wc-${crypto.randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO wisdomContent
         (id, moduleId, title, type, pillarId, audience, body, sortOrder, isActive, level, hasQuiz, quizQuestions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    )
    .bind(
      id,
      moduleId,
      input.title.trim(),
      input.type,
      mod.pillarId,
      mod.audience,
      input.body?.trim() || null,
      input.sortOrder,
      input.isActive ? 1 : 0,
      mod.level,
    )
    .run();
}

export async function updateContent(
  session: SessionUser,
  id: string,
  input: WisdomContentInput,
): Promise<void> {
  assertRole(session, "admin");
  if (!input.title.trim()) throw new Error("Content title is required.");
  await getDB()
    .prepare(
      "UPDATE wisdomContent SET title=?, type=?, body=?, sortOrder=?, isActive=? WHERE id=?",
    )
    .bind(
      input.title.trim(),
      input.type,
      input.body?.trim() || null,
      input.sortOrder,
      input.isActive ? 1 : 0,
      id,
    )
    .run();
}

export async function deleteContent(session: SessionUser, id: string): Promise<void> {
  assertRole(session, "admin");
  await getDB().prepare("DELETE FROM wisdomContent WHERE id = ?").bind(id).run();
}
