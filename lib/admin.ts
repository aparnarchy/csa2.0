/**
 * Admin data layer (Phase 4.4) — real D1 reads/writes for the admin panel.
 *
 * This is the app's first feature surface that writes to the database, so the
 * pattern lives here: every function takes the caller's session and guards with
 * `assertRole(session, "admin")` BEFORE touching D1. Privacy/authorisation is
 * enforced in server code, never in the UI.
 */

import { Resend } from "resend";
import { getDB } from "@/lib/db";
import { assertRole } from "@/lib/access-control";
import type { RecommendationAudience } from "@/lib/recommendations";
export type { RecommendationAudience } from "@/lib/recommendations";
import type {
  ContentType,
  Department,
  Invite,
  PillarId,
  Question,
  Role,
  SessionUser,
  Team,
  WisdomAudience,
  WisdomContent,
  WisdomLevel,
  WisdomModule,
} from "@/lib/types";

/** One append-only audit entry for an admin change (who, what, when). Returned
 *  as a statement so callers can put it in the same batch as the change. */
function auditStmt(
  db: D1Database,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  detail: Record<string, unknown>,
): D1PreparedStatement {
  return db
    .prepare(
      "INSERT INTO adminAuditLog (id, actorId, action, targetType, targetId, detail) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(`aud-${crypto.randomUUID()}`, actorId, action, targetType, targetId, JSON.stringify(detail));
}

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

/** Summary returned after a bulk delete — some questions may be protected. */
export interface BulkDeleteResult {
  deleted: number;
  /** Already answered (checkIns) or currently assigned (checkInAssignments) —
      hard-deleting would silently drop that history from every report, so these
      are deactivated instead (same effect on the check-in pool, no data loss). */
  deactivated: number;
}

/**
 * Delete many questions at once. A question that already has real answers or
 * live assignments is never hard-deleted (that would orphan historical
 * check-ins and silently vanish from past reports) — it's deactivated instead,
 * same as the single-row status toggle. Admin only.
 */
export async function bulkDeleteQuestions(
  session: SessionUser,
  ids: string[],
): Promise<BulkDeleteResult> {
  assertRole(session, "admin");
  const db = getDB();
  let deleted = 0;
  let deactivated = 0;
  for (const id of ids) {
    const used = await db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM checkIns WHERE questionId = ?) +
           (SELECT COUNT(*) FROM checkInAssignments WHERE questionId = ?) AS n`,
      )
      .bind(id, id)
      .first<{ n: number }>();
    if ((used?.n ?? 0) > 0) {
      await db.prepare("UPDATE questions SET isActive = 0 WHERE id = ?").bind(id).run();
      deactivated++;
    } else {
      await db.prepare("DELETE FROM questions WHERE id = ?").bind(id).run();
      deleted++;
    }
  }
  return { deleted, deactivated };
}

const PILLAR_IDS: readonly PillarId[] = ["meaningful_work", "growth", "culture", "compensation"];

/**
 * Bulk-import questions from raw CSV text — the SAME column shape the question
 * bank table displays and QuestionInput uses, so an admin can export, edit in a
 * spreadsheet, and re-import: `text,pillarId,optionA_text,optionA_score,
 * optionB_text,optionB_score,optionC_text,optionC_score,isActive`. `isActive` is
 * optional (defaults to true: "true"/"1"/"yes", case-insensitive, are truthy).
 * A header row is auto-detected. Malformed rows are skipped with a message; the
 * valid rows still import. Admin only.
 */
export async function importQuestionsCsv(
  session: SessionUser,
  text: string,
): Promise<CsvImportResult> {
  assertRole(session, "admin");
  const result: CsvImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    result.errors.push("The file is empty.");
    return result;
  }

  const REQUIRED = [
    "text", "pillarid", "optiona_text", "optiona_score",
    "optionb_text", "optionb_score", "optionc_text", "optionc_score",
  ];
  let cols: Record<string, number> = {
    text: 0, pillarid: 1, optiona_text: 2, optiona_score: 3,
    optionb_text: 4, optionb_score: 5, optionc_text: 6, optionc_score: 7, isactive: 8,
  };
  let start = 0;
  const firstCells = splitCsvLine(lines[0]).map((c) => c.trim().toLowerCase());
  if (REQUIRED.every((k) => firstCells.includes(k))) {
    start = 1;
    cols = Object.fromEntries(firstCells.map((c, i) => [c, i]));
  }

  for (let i = start; i < lines.length; i++) {
    const rowNo = i + 1;
    const cells = splitCsvLine(lines[i]);
    const cell = (key: string) => (cols[key] >= 0 ? (cells[cols[key]] ?? "").trim() : "");

    const pillarRaw = cell("pillarid").toLowerCase().replace(/\s+/g, "_");
    if (!PILLAR_IDS.includes(pillarRaw as PillarId)) {
      result.skipped++;
      result.errors.push(`Row ${rowNo}: pillar "${cell("pillarid")}" isn't one of ${PILLAR_IDS.join(", ")} — skipped.`);
      continue;
    }
    const aScore = Number(cell("optiona_score"));
    const bScore = Number(cell("optionb_score"));
    const cScore = Number(cell("optionc_score"));
    const isActiveRaw = cell("isactive").toLowerCase();
    const input: QuestionInput = {
      text: cell("text"),
      pillarId: pillarRaw as PillarId,
      optionA_text: cell("optiona_text"),
      optionA_score: Math.round(aScore),
      optionB_text: cell("optionb_text"),
      optionB_score: Math.round(bScore),
      optionC_text: cell("optionc_text"),
      optionC_score: Math.round(cScore),
      isActive: isActiveRaw === "" ? true : ["true", "1", "yes"].includes(isActiveRaw),
    };
    try {
      validate(input);
    } catch (e) {
      result.skipped++;
      result.errors.push(`Row ${rowNo}: ${e instanceof Error ? e.message : "invalid row"} — skipped.`);
      continue;
    }
    await createQuestion(session, input);
    result.created++;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recommendations: one real coaching tip per question, shown whenever that
// question scores low. Fixed scoreBand 0–6 (matches the A/B/C scale's "low"
// answer, 4) — the only band ever surfaced today. Any question without a row
// here falls back to a generic pillar-level placeholder (lib/recommendations.ts),
// so the app never breaks while these are still being filled in.
// ─────────────────────────────────────────────────────────────────────────────

/** One question plus whatever recommendation text is on file for it, if any —
 *  separately for each audience (the employee reading their own low score vs
 *  the manager coaching a team member on it). */
export interface RecommendationRow {
  questionId: string;
  questionText: string;
  pillarId: PillarId;
  employeeText: string | null;
  managerText: string | null;
}

interface QuestionForRecRow {
  id: string;
  text: string;
  pillarId: PillarId;
}

/** Every question, each paired with its employee and manager recommendation
 *  text (or null if the admin hasn't written one yet). Admin only. */
export async function getRecommendationsCms(session: SessionUser): Promise<RecommendationRow[]> {
  assertRole(session, "admin");
  const db = getDB();
  const [{ results: qRows }, { results: recRows }] = await Promise.all([
    db.prepare("SELECT id, text, pillarId FROM questions").all<QuestionForRecRow>(),
    db
      .prepare("SELECT questionId, audience, text FROM recommendations")
      .all<{ questionId: string; audience: RecommendationAudience; text: string }>(),
  ]);
  const employeeByQ = new Map(recRows.filter((r) => r.audience === "employee").map((r) => [r.questionId, r.text]));
  const managerByQ = new Map(recRows.filter((r) => r.audience === "manager").map((r) => [r.questionId, r.text]));
  return qRows
    .map((q) => ({
      questionId: q.id,
      questionText: q.text,
      pillarId: q.pillarId,
      employeeText: employeeByQ.get(q.id) ?? null,
      managerText: managerByQ.get(q.id) ?? null,
    }))
    .sort((a, b) => PILLAR_RANK[a.pillarId] - PILLAR_RANK[b.pillarId] || a.questionId.localeCompare(b.questionId));
}

/** Write (or overwrite) one audience's recommendation for one question. Admin only. */
export async function upsertRecommendation(
  session: SessionUser,
  questionId: string,
  audience: RecommendationAudience,
  text: string,
): Promise<RecommendationRow[]> {
  assertRole(session, "admin");
  if (!text.trim()) throw new Error("Recommendation text is required.");
  const db = getDB();
  const q = await db
    .prepare("SELECT pillarId FROM questions WHERE id = ?")
    .bind(questionId)
    .first<{ pillarId: PillarId }>();
  if (!q) throw new Error("Unknown question.");
  const existing = await db
    .prepare("SELECT id FROM recommendations WHERE questionId = ? AND audience = ?")
    .bind(questionId, audience)
    .first<{ id: string }>();
  if (existing) {
    await db.prepare("UPDATE recommendations SET text = ? WHERE id = ?").bind(text.trim(), existing.id).run();
  } else {
    await db
      .prepare(
        `INSERT INTO recommendations (id, questionId, pillarId, scoreBandMin, scoreBandMax, text, audience)
         VALUES (?, ?, ?, 0, 6, ?, ?)`,
      )
      .bind(`rec-${questionId}-${audience}`, questionId, q.pillarId, text.trim(), audience)
      .run();
  }
  return getRecommendationsCms(session);
}

/** Remove one audience's recommendation for a question, reverting it to the
 *  generic pillar placeholder. Admin only. */
export async function clearRecommendation(
  session: SessionUser,
  questionId: string,
  audience: RecommendationAudience,
): Promise<RecommendationRow[]> {
  assertRole(session, "admin");
  const db = getDB();
  await db
    .prepare("DELETE FROM recommendations WHERE questionId = ? AND audience = ?")
    .bind(questionId, audience)
    .run();
  return getRecommendationsCms(session);
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
  teams: OrgTeam[];
  managers: ManagerOption[];
}

/** A team plus anyone named to lead it who isn't confirmed yet. */
export interface OrgTeam extends Team {
  pendingManagerEmail: string | null;
}

type TeamRow = OrgTeam;

export async function getOrgStructure(session: SessionUser): Promise<OrgStructure> {
  assertRole(session, "admin");
  const db = getDB();
  const [depts, teams, mgrs] = await Promise.all([
    db.prepare("SELECT id, name FROM departments ORDER BY name").all<Department>(),
    db
      .prepare("SELECT id, name, managerId, departmentId, pendingManagerEmail FROM teams ORDER BY name")
      .all<TeamRow>(),
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

// ─────────────────────────────────────────────────────────────────────────────
// People & roles: the only in-app way to grant/revoke roles. Before this, role
// changes had to be made directly in the database.
// ─────────────────────────────────────────────────────────────────────────────

/** Every role an admin is allowed to grant or revoke from this screen. */
const ASSIGNABLE_ROLES: readonly Role[] = ["employee", "manager", "ceo_hr", "admin"];

export interface PersonRow {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  teamName: string | null;
  departmentName: string | null;
  /** True for someone who hasn't signed up yet — this row is their pending
   *  invite, not a real account. `id` is the invite id in that case, and they
   *  hold no roles yet: signup makes them an employee, and leading a team
   *  needs admin approval afterwards (see applyPendingInvite in lib/auth.ts). */
  isPending: boolean;
}

/** A team someone has been named to lead, waiting on an admin. */
export interface PendingManager {
  teamId: string;
  teamName: string;
  email: string;
  /** Null until they've signed up — only signed-up people can be approved. */
  userId: string | null;
  userName: string | null;
  signedUpAt: string | null;
}

/** Everyone named to lead a team who isn't confirmed yet. Admin only. */
export async function listPendingManagers(session: SessionUser): Promise<PendingManager[]> {
  assertRole(session, "admin");
  const { results } = await getDB()
    .prepare(
      `SELECT t.id AS teamId, t.name AS teamName, t.pendingManagerEmail AS email,
              u.id AS userId, u.name AS userName, u.createdAt AS signedUpAt
         FROM teams t
         LEFT JOIN user u ON lower(u.email) = lower(t.pendingManagerEmail)
        WHERE t.pendingManagerEmail IS NOT NULL
        ORDER BY u.id IS NULL, t.name`,
    )
    .all<PendingManager>();
  return results;
}

/**
 * Confirm that the account holding a team's pending-manager email really is
 * that person: they become the team's manager and get the manager role. This
 * click is the only thing standing between "someone signed up with the boss's
 * email address" and seeing that team's data, since signup can't verify email
 * ownership yet. Admin only.
 */
export async function approvePendingManager(session: SessionUser, teamId: string): Promise<void> {
  assertRole(session, "admin");
  const db = getDB();
  const row = await db
    .prepare(
      `SELECT u.id AS userId FROM teams t
         JOIN user u ON lower(u.email) = lower(t.pendingManagerEmail)
        WHERE t.id = ?`,
    )
    .bind(teamId)
    .first<{ userId: string }>();
  if (!row) throw new Error("They haven't signed up yet — approve them once they have.");
  await db.batch([
    db.prepare("UPDATE teams SET managerId = ?, pendingManagerEmail = NULL WHERE id = ?").bind(row.userId, teamId),
    db.prepare("INSERT OR IGNORE INTO user_roles (userId, role) VALUES (?, 'manager')").bind(row.userId),
  ]);
}

/** Withdraw a pending team lead. The team's current manager (if any) stays. Admin only. */
export async function rejectPendingManager(session: SessionUser, teamId: string): Promise<void> {
  assertRole(session, "admin");
  await getDB().prepare("UPDATE teams SET pendingManagerEmail = NULL WHERE id = ?").bind(teamId).run();
}

interface PersonUserRow {
  id: string;
  name: string;
  email: string;
  teamName: string | null;
  departmentName: string | null;
}

export async function listPeople(session: SessionUser): Promise<PersonRow[]> {
  assertRole(session, "admin");
  const db = getDB();
  const [{ results: users }, { results: roleRows }, { results: pending }] = await Promise.all([
    db
      .prepare(
        `SELECT u.id, u.name, u.email, t.name AS teamName, d.name AS departmentName
           FROM user u
           LEFT JOIN teams t ON t.id = u.teamId
           LEFT JOIN departments d ON d.id = t.departmentId
          ORDER BY u.name`,
      )
      .all<PersonUserRow>(),
    db.prepare("SELECT userId, role FROM user_roles").all<{ userId: string; role: Role }>(),
    // Pending invites — someone the admin has already assigned a role/team to,
    // but who hasn't created their own account yet (open self-signup means the
    // app never creates one for them). Listed here too so there's one screen
    // for "who can do what," not two, regardless of signup status.
    db
      .prepare(
        `SELECT i.id, i.email, i.name, t.name AS teamName,
                COALESCE(d.name, id2.name) AS departmentName
           FROM invites i
           LEFT JOIN teams t ON t.id = i.teamId
           LEFT JOIN departments d ON d.id = t.departmentId
           LEFT JOIN departments id2 ON id2.id = i.departmentId
          WHERE i.status = 'pending'
          ORDER BY i.email`,
      )
      .all<{ id: string; email: string; name: string | null; teamName: string | null; departmentName: string | null }>(),
  ]);

  const rolesByUser = new Map<string, Role[]>();
  for (const r of roleRows) {
    // 'reviewing_manager' is a dead role (removed from the app, still valid in
    // the old CHECK constraint) — nothing assigns it, so it never surfaces here.
    if (!ASSIGNABLE_ROLES.includes(r.role)) continue;
    const arr = rolesByUser.get(r.userId) ?? [];
    arr.push(r.role);
    rolesByUser.set(r.userId, arr);
  }

  const existing: PersonRow[] = users.map((u) => ({
    ...u,
    roles: rolesByUser.get(u.id) ?? [],
    isPending: false,
  }));
  const pendingRows: PersonRow[] = pending.map((p) => ({
    id: p.id,
    name: p.name || p.email, // roster name if we have one, else email until they sign up
    email: p.email,
    roles: [],
    teamName: p.teamName,
    departmentName: p.departmentName,
    isPending: true,
  }));

  return [...existing, ...pendingRows].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Replace a person's full role set. Two guards that only make sense here, not
 * per-role: a person must keep at least one role (every dashboard route
 * redirects by role, so zero roles would strand them with nowhere to land),
 * and the very last admin account can't have admin revoked — that would lock
 * everyone, including every other admin, out of this screen for good with no
 * in-app way back.
 */
export async function setUserRoles(
  session: SessionUser,
  userId: string,
  roles: Role[],
): Promise<PersonRow[]> {
  assertRole(session, "admin");
  const clean = [...new Set(roles)].filter((r) => ASSIGNABLE_ROLES.includes(r));
  if (clean.length === 0) throw new Error("A person needs at least one role.");

  const db = getDB();
  if (!clean.includes("admin")) {
    const [current, others] = await Promise.all([
      db
        .prepare("SELECT 1 AS x FROM user_roles WHERE userId = ? AND role = 'admin'")
        .bind(userId)
        .first<{ x: number }>(),
      db
        .prepare("SELECT 1 AS x FROM user_roles WHERE role = 'admin' AND userId != ? LIMIT 1")
        .bind(userId)
        .first<{ x: number }>(),
    ]);
    if (current && !others) {
      throw new Error("Can't remove admin from the last admin account.");
    }
  }

  await db.batch([
    db.prepare("DELETE FROM user_roles WHERE userId = ?").bind(userId),
    ...clean.map((r) =>
      db.prepare("INSERT INTO user_roles (userId, role) VALUES (?, ?)").bind(userId, r),
    ),
  ]);

  return listPeople(session);
}

/** A UNIQUE-index violation from D1 (e.g. a duplicate department/team name),
    surfaced as a plain-English message instead of a raw SQL error. */
function isUniqueConstraintError(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
}

export async function createDepartment(session: SessionUser, name: string): Promise<void> {
  assertRole(session, "admin");
  if (!name.trim()) throw new Error("Department name is required.");
  const id = `dept-${crypto.randomUUID().slice(0, 8)}`;
  try {
    await getDB().prepare("INSERT INTO departments (id, name) VALUES (?, ?)").bind(id, name.trim()).run();
  } catch (e) {
    if (isUniqueConstraintError(e)) throw new Error("A department with this name already exists.");
    throw e;
  }
}

export async function updateDepartment(
  session: SessionUser,
  id: string,
  name: string,
): Promise<void> {
  assertRole(session, "admin");
  if (!name.trim()) throw new Error("Department name is required.");
  try {
    await getDB().prepare("UPDATE departments SET name = ? WHERE id = ?").bind(name.trim(), id).run();
  } catch (e) {
    if (isUniqueConstraintError(e)) throw new Error("A department with this name already exists.");
    throw e;
  }
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

/** The editable fields of a team. `leaderEmail` names a manager who isn't in
 *  the manager list yet (e.g. hasn't signed up) — they lead the team once an
 *  admin approves them (see nameTeamLeader). */
export interface TeamInput {
  name: string;
  departmentId: string | null;
  managerId: string | null;
  leaderEmail?: string | null;
}

function cleanLeaderEmail(input: TeamInput): string | null {
  const email = input.leaderEmail?.trim().toLowerCase() || null;
  if (email && !EMAIL_RE.test(email)) throw new Error("The new manager's email isn't valid.");
  return email;
}

export async function createTeam(session: SessionUser, input: TeamInput): Promise<void> {
  assertRole(session, "admin");
  if (!input.name.trim()) throw new Error("Team name is required.");
  const leaderEmail = cleanLeaderEmail(input);
  const id = `team-${crypto.randomUUID().slice(0, 8)}`;
  try {
    await getDB()
      .prepare("INSERT INTO teams (id, name, managerId, departmentId) VALUES (?, ?, ?, ?)")
      .bind(id, input.name.trim(), input.managerId || null, input.departmentId || null)
      .run();
  } catch (e) {
    if (isUniqueConstraintError(e)) throw new Error("A team with this name already exists.");
    throw e;
  }
  if (leaderEmail) await nameTeamLeader(getDB(), id, leaderEmail);
}

export async function updateTeam(
  session: SessionUser,
  id: string,
  input: TeamInput,
): Promise<void> {
  assertRole(session, "admin");
  if (!input.name.trim()) throw new Error("Team name is required.");
  const leaderEmail = cleanLeaderEmail(input);
  try {
    await getDB()
      .prepare("UPDATE teams SET name = ?, managerId = ?, departmentId = ? WHERE id = ?")
      .bind(input.name.trim(), input.managerId || null, input.departmentId || null, id)
      .run();
  } catch (e) {
    if (isUniqueConstraintError(e)) throw new Error("A team with this name already exists.");
    throw e;
  }
  if (leaderEmail) await nameTeamLeader(getDB(), id, leaderEmail);
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

// ─────────────────────────────────────────────────────────────────────────────
// Invites (Phase 4.4). Admin invites managers / individuals, optionally onto a
// team, and can bulk-import from CSV. Records + UI are built now; the actual
// email SEND is intentionally stubbed until the email service (Resend) key is
// configured — that step is the owner's (see the TODO(email) markers).
// ─────────────────────────────────────────────────────────────────────────────

/** An invite enriched with display names for the admin list. */
export interface InviteWithMeta extends Invite {
  teamName: string | null;
  departmentName: string | null;
  /** A team this email has been named to lead (current or awaiting approval). */
  leadsTeamName: string | null;
}

type InviteRow = InviteWithMeta;

/** The editable fields of an invite. `role` uses the DB values (employee/manager).
 *  A manager invite's team is the team they LEAD (not join) — see createInvite. */
export interface InviteInput {
  email: string;
  role: "manager" | "employee";
  teamId: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Try to email someone their signup link, and report honestly whether it went.
 * Best-effort — a failure never undoes the invite row that's already saved.
 * The email service rejects (rather than throws for) addresses it can't deliver
 * to, e.g. anyone outside the account owner while no domain is verified, so the
 * returned `error` has to be checked, not just exceptions.
 */
async function sendInviteEmail(email: string): Promise<"sent" | "failed"> {
  try {
    if (!process.env.RESEND_API_KEY) return "failed";
    const resend = new Resend(process.env.RESEND_API_KEY);
    const signupUrl = `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/signup`;
    const { error } = await resend.emails.send({
      from: "CSA <noreply@resend.dev>",
      to: email,
      subject: "You're invited to CSA",
      html: `
        <p>Hi,</p>
        <p>You've been invited to join CSA (Culture Super App). Sign up using this
        email address to get started:</p>
        <p><a href="${signupUrl}">${signupUrl}</a></p>
      `,
    });
    if (error) {
      console.error("Invite email not delivered:", error);
      return "failed";
    }
    return "sent";
  } catch (e) {
    console.error("Failed to send invite email:", e);
    return "failed";
  }
}

/** Normalise a role cell: accept "individual" as a friendly alias for employee. */
function normaliseRole(raw: string): "manager" | "employee" | null {
  const r = raw.trim().toLowerCase();
  if (r === "manager") return "manager";
  if (r === "employee" || r === "individual") return "employee";
  return null;
}

/** All invites, newest first, with team/department/led-team names. Admin only. */
export async function getInvites(session: SessionUser): Promise<InviteWithMeta[]> {
  assertRole(session, "admin");
  const { results } = await getDB()
    .prepare(
      `SELECT i.id, i.email, i.name, i.grade, i.role, i.invitedBy, i.teamId, i.departmentId,
              i.status, i.emailStatus, i.createdAt,
              t.name AS teamName,
              COALESCE(d.name, td.name) AS departmentName,
              (SELECT lt.name FROM teams lt
                 LEFT JOIN user lu ON lu.id = lt.managerId
                WHERE lower(lt.pendingManagerEmail) = lower(i.email) OR lower(lu.email) = lower(i.email)
                LIMIT 1) AS leadsTeamName
         FROM invites i
         LEFT JOIN teams t ON t.id = i.teamId
         LEFT JOIN departments td ON td.id = t.departmentId
         LEFT JOIN departments d ON d.id = i.departmentId
        ORDER BY i.createdAt DESC`,
    )
    .all<InviteRow>();
  return results;
}

/**
 * Name `email` as the leader of a team. Someone who already holds the manager
 * role (an admin approved them before) takes over straight away; anyone else
 * is parked on teams.pendingManagerEmail until an admin approves them — signup
 * doesn't prove they own that inbox (see applyPendingInvite in lib/auth.ts).
 * The team's current manager, if any, keeps their dashboard until then.
 */
async function nameTeamLeader(db: D1Database, teamId: string, email: string): Promise<void> {
  const approved = await db
    .prepare(
      `SELECT u.id FROM user u JOIN user_roles ur ON ur.userId = u.id AND ur.role = 'manager'
        WHERE lower(u.email) = lower(?)`,
    )
    .bind(email)
    .first<{ id: string }>();
  if (approved) {
    await db
      .prepare("UPDATE teams SET managerId = ?, pendingManagerEmail = NULL WHERE id = ?")
      .bind(approved.id, teamId)
      .run();
  } else {
    await db
      .prepare("UPDATE teams SET pendingManagerEmail = ? WHERE id = ?")
      .bind(email.toLowerCase(), teamId)
      .run();
  }
}

/**
 * Create an invite. If a *pending* invite already exists for the same email we
 * reuse it (refresh its role/team + timestamp) rather than duplicating. Returns
 * whether a new row was created. Admin only.
 *
 * Quiet: nobody is emailed here (the owner doesn't want to mass-notify during
 * the pilot) — "Email link" on the invite list sends it on purpose.
 *
 * A *manager* invite with a team means they LEAD that team: recorded on the
 * team (awaiting approval), and they aren't made a member of it — otherwise
 * their own check-ins would be counted in the team they manage.
 */
export async function createInvite(
  session: SessionUser,
  input: InviteInput,
): Promise<{ created: boolean }> {
  assertRole(session, "admin");
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("A valid email address is required.");
  if (input.role !== "manager" && input.role !== "employee") {
    throw new Error("Role must be manager or individual.");
  }
  const db = getDB();
  const leadsTeamId = input.role === "manager" && input.teamId ? input.teamId : null;
  const memberTeamId = leadsTeamId ? null : input.teamId || null;

  const existing = await db
    .prepare("SELECT id FROM invites WHERE lower(email) = ? AND status = 'pending'")
    .bind(email)
    .first<{ id: string }>();
  let created = false;
  if (existing) {
    await db
      .prepare("UPDATE invites SET role = ?, teamId = ?, createdAt = datetime('now') WHERE id = ?")
      .bind(input.role, memberTeamId, existing.id)
      .run();
  } else {
    const id = `inv-${crypto.randomUUID().slice(0, 8)}`;
    try {
      await db
        .prepare(
          "INSERT INTO invites (id, email, role, invitedBy, teamId, status) VALUES (?, ?, ?, ?, ?, 'pending')",
        )
        .bind(id, email, input.role, session.id, memberTeamId)
        .run();
    } catch (e) {
      // The "existing" check above and this insert aren't atomic, so a second
      // request for the same email in the same instant could still race past
      // it — the partial unique index (migration 0012) is the real guarantee.
      if (isUniqueConstraintError(e)) throw new Error("A pending invite for this email already exists.");
      throw e;
    }
    created = true;
  }
  if (leadsTeamId) await nameTeamLeader(db, leadsTeamId, email);
  return { created };
}

/** Email a pending invite its signup link, recording whether it was delivered. */
export async function resendInvite(session: SessionUser, id: string): Promise<void> {
  assertRole(session, "admin");
  const db = getDB();
  const invite = await db
    .prepare("SELECT email FROM invites WHERE id = ? AND status = 'pending'")
    .bind(id)
    .first<{ email: string }>();
  if (!invite) return;
  const status = await sendInviteEmail(invite.email);
  await db.prepare("UPDATE invites SET emailStatus = ? WHERE id = ?").bind(status, id).run();
}

/** Cancel (delete) an invite. Admin only. */
export async function cancelInvite(session: SessionUser, id: string): Promise<void> {
  assertRole(session, "admin");
  await getDB().prepare("DELETE FROM invites WHERE id = ?").bind(id).run();
}

/** Summary returned after a CSV bulk import. */
export interface CsvImportResult {
  created: number;
  updated: number; // matched an existing pending invite and refreshed it
  skipped: number; // rows rejected because of an error
  errors: string[]; // one human-readable message per problem row
  /** Roster upload only: people who already had an account and were placed directly. */
  linked?: number;
  /** Roster upload only: plain-English notes on what was worked out (teams, leaders). */
  notes?: string[];
}

/** Split one CSV line into cells, honouring simple double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Header aliases for the roster upload, matched case-insensitively. */
const ROSTER_COLUMNS = {
  email: ["email", "work email", "email address", "official email"],
  name: ["name", "full name", "employee name"],
  team: ["team", "team name"],
  department: ["department", "dept"],
  grade: ["grade", "level", "band"],
  manager: [
    "manager email",
    "manager",
    "manager_email",
    "reports to",
    "reporting manager",
    "reporting manager email",
  ],
  employeeId: ["employee id", "emp id", "employee_id", "empid", "employee code", "emp code", "employee no", "employee number"],
  role: ["role"],
} as const;

type RosterCol = keyof typeof ROSTER_COLUMNS;

/**
 * Bulk-import from raw CSV text. Two formats, told apart by the header row:
 *
 * - **Roster** (any of employee id / name / department / grade / manager
 *   email columns):
 *   the org's people list, which the app turns into teams, departments,
 *   managers and memberships on its own — see importRoster.
 * - **Legacy** (`email, role, team`, header optional): one invite per row,
 *   exactly as before. Malformed rows are skipped with a message and the
 *   valid rows still import.
 *
 * Neither format emails anyone. Admin only.
 */
export async function importInvitesCsv(
  session: SessionUser,
  text: string,
): Promise<CsvImportResult> {
  assertRole(session, "admin");
  const db = getDB();
  const result: CsvImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    result.errors.push("The file is empty.");
    return result;
  }

  const firstCells = splitCsvLine(lines[0]).map((c) => c.trim().toLowerCase());
  const colOf = (key: RosterCol) =>
    firstCells.findIndex((c) => (ROSTER_COLUMNS[key] as readonly string[]).includes(c));
  if (
    colOf("email") >= 0 &&
    (["name", "department", "grade", "manager", "employeeId"] as const).some((k) => colOf(k) >= 0)
  ) {
    return importRoster(session, lines.slice(1), {
      email: colOf("email"),
      employeeId: colOf("employeeId"),
      name: colOf("name"),
      team: colOf("team"),
      department: colOf("department"),
      grade: colOf("grade"),
      manager: colOf("manager"),
    });
  }

  // Team-name → id lookup (case-insensitive) for the optional team column.
  const { results: teamRows } = await db.prepare("SELECT id, name FROM teams").all<{
    id: string;
    name: string;
  }>();
  const teamByName = new Map(teamRows.map((t) => [t.name.trim().toLowerCase(), t.id]));

  // Detect a header row (contains an "email" cell); otherwise assume email,role,team.
  let cols = { email: 0, role: 1, team: 2 };
  let start = 0;
  if (firstCells.includes("email")) {
    start = 1;
    cols = {
      email: firstCells.indexOf("email"),
      role: firstCells.indexOf("role"),
      team: firstCells.indexOf("team"),
    };
  }

  for (let i = start; i < lines.length; i++) {
    const rowNo = i + 1; // 1-based for human-friendly messages
    const cells = splitCsvLine(lines[i]);
    const email = (cells[cols.email] ?? "").trim().toLowerCase();
    const roleRaw = cols.role >= 0 ? (cells[cols.role] ?? "") : "";
    const teamName = cols.team >= 0 ? (cells[cols.team] ?? "").trim() : "";

    if (!EMAIL_RE.test(email)) {
      result.skipped++;
      result.errors.push(`Row ${rowNo}: “${cells[cols.email] ?? ""}” is not a valid email — skipped.`);
      continue;
    }
    const role = normaliseRole(roleRaw);
    if (!role) {
      result.skipped++;
      result.errors.push(`Row ${rowNo} (${email}): role must be “manager” or “individual” — skipped.`);
      continue;
    }

    let teamId: string | null = null;
    if (teamName) {
      const found = teamByName.get(teamName.toLowerCase());
      if (found) {
        teamId = found;
      } else {
        result.errors.push(
          `Row ${rowNo} (${email}): team “${teamName}” not found — invited without a team.`,
        );
      }
    }

    try {
      const { created } = await createInvite(session, { email, role, teamId });
      if (created) result.created++;
      else result.updated++;
    } catch (e) {
      result.skipped++;
      const msg = e instanceof Error ? e.message : "could not be saved";
      result.errors.push(`Row ${rowNo} (${email}): ${msg} — skipped.`);
    }
  }

  return result;
}

interface RosterRow {
  rowNo: number;
  email: string;
  employeeId: string; // "" = not given
  name: string;
  team: string; // as typed; "" = none
  department: string;
  grade: string;
  manager: string; // lower-cased email; "" = none
}

/** A team the roster describes — either named in the file, or made for a
 *  manager whose reports had no team column ("Raj's team"). */
interface RosterTeam {
  name: string;
  leader: string | null; // email
  department: string; // name; "" = unknown
}

/**
 * Turn an org's people list into the app's structure, the way the owner
 * described it: the upload is the source of truth, and nobody should have to
 * link managers by hand afterwards.
 *
 * - **Who leads a team** comes from the manager-email column: if Priya is on
 *   Design and names raj@ as her manager, raj@ leads Design. Raj's own row is
 *   left out of that vote (he names *his* manager), so a head listed inside
 *   their own team doesn't create a false conflict.
 * - **A leader is never a member of the team they lead** — their own answers
 *   would otherwise be mixed into their team's scores. They're placed in the
 *   team *their* manager leads instead, so the reporting chain builds itself.
 * - **No team column?** People are grouped under their manager ("Raj's team").
 * - Teams and departments that don't exist yet are created.
 * - People who already have an account are placed straight away; everyone else
 *   gets a quiet pending invite (nobody is emailed) and is placed on signup.
 * - New leaders wait for admin approval (see nameTeamLeader).
 * - People are matched by employee ID first, then email (emails change, IDs
 *   don't). Anyone active in the app but missing from the file is listed, not
 *   removed — the admin decides whether they've left.
 *
 * All writes go in one batch, so a failed upload changes nothing.
 */
async function importRoster(
  session: SessionUser,
  lines: string[],
  cols: Record<Exclude<RosterCol, "role">, number>,
): Promise<CsvImportResult> {
  const db = getDB();
  const result: CsvImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    linked: 0,
    notes: [],
  };
  const notes = result.notes!;
  const cell = (cells: string[], i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");

  // ── 1. Parse and validate rows ────────────────────────────────────────────
  const rows: RosterRow[] = [];
  const seen = new Set<string>();
  const seenIds = new Set<string>();
  lines.forEach((line, idx) => {
    const rowNo = idx + 2; // header is row 1
    const cells = splitCsvLine(line);
    const email = cell(cells, cols.email).toLowerCase();
    if (!EMAIL_RE.test(email)) {
      result.skipped++;
      result.errors.push(`Row ${rowNo}: “${cell(cells, cols.email)}” is not a valid email — skipped.`);
      return;
    }
    if (seen.has(email)) {
      result.skipped++;
      result.errors.push(`Row ${rowNo} (${email}): appears more than once — kept the first row.`);
      return;
    }
    const employeeId = cell(cells, cols.employeeId);
    if (employeeId && seenIds.has(employeeId.toLowerCase())) {
      result.skipped++;
      result.errors.push(`Row ${rowNo} (${email}): employee ID ${employeeId} is used by an earlier row — skipped.`);
      return;
    }
    seen.add(email);
    if (employeeId) seenIds.add(employeeId.toLowerCase());
    let manager = cell(cells, cols.manager).toLowerCase();
    if (manager && !EMAIL_RE.test(manager)) {
      result.errors.push(`Row ${rowNo} (${email}): manager “${manager}” isn't an email — ignored.`);
      manager = "";
    }
    if (manager === email) {
      result.errors.push(`Row ${rowNo} (${email}): lists themselves as manager — ignored.`);
      manager = "";
    }
    rows.push({
      rowNo,
      email,
      employeeId,
      name: cell(cells, cols.name),
      team: cell(cells, cols.team),
      department: cell(cells, cols.department),
      grade: cell(cells, cols.grade),
      manager,
    });
  });
  if (rows.length === 0) return result;

  const nameOf = (email: string) =>
    rows.find((r) => r.email === email)?.name || email.split("@")[0];

  // ── 2. Work out teams and who leads each ──────────────────────────────────
  const teams = new Map<string, RosterTeam>(); // key: lower-cased team name
  for (const r of rows) {
    if (r.team && !teams.has(r.team.toLowerCase())) {
      teams.set(r.team.toLowerCase(), { name: r.team, leader: null, department: "" });
    }
  }
  for (const [key, team] of teams) {
    const inTeam = rows.filter((r) => r.team.toLowerCase() === key);
    const named = new Set(inTeam.map((r) => r.manager).filter(Boolean));
    const votes = new Set(
      inTeam.filter((r) => r.manager && !named.has(r.email)).map((r) => r.manager),
    );
    if (votes.size === 1) {
      team.leader = [...votes][0];
    } else if (votes.size > 1) {
      result.errors.push(
        `Team “${team.name}”: rows name different managers (${[...votes].join(", ")}) — no manager set for this team. Fix the file and upload again.`,
      );
    }
  }

  /** The team `email` leads, creating "<Name>'s team" if they lead none yet. */
  const teamLedBy = (email: string): string => {
    const found = [...teams].find(([, t]) => t.leader === email);
    if (found) return found[0];
    const name = `${nameOf(email)}'s team`;
    const key = name.toLowerCase();
    if (!teams.has(key)) teams.set(key, { name, leader: email, department: "" });
    return key;
  };

  // Membership: which team each person belongs to (null = none).
  const memberOf = new Map<string, string | null>();
  for (const r of rows) {
    const key = r.team.toLowerCase();
    if (r.team && teams.get(key)!.leader !== r.email) memberOf.set(r.email, key);
    else memberOf.set(r.email, r.manager ? teamLedBy(r.manager) : null);
  }

  // A team's department: its members' one if they agree, otherwise its
  // leader's (e.g. a CEO's team of department heads sits in Leadership, not in
  // whichever department the first head happens to run).
  for (const [key, team] of teams) {
    const depts = [
      ...new Set(rows.filter((r) => memberOf.get(r.email) === key && r.department).map((r) => r.department)),
    ];
    const leaderDept = rows.find((r) => r.email === team.leader)?.department ?? "";
    if (depts.length === 1) team.department = depts[0];
    else if (leaderDept) team.department = leaderDept;
    else if (depts.length > 1) {
      team.department = depts[0];
      notes.push(`“${team.name}” has people in more than one department (${depts.join(", ")}) — using ${depts[0]}.`);
    }
  }

  // ── 3. Load what already exists ───────────────────────────────────────────
  const [
    { results: deptRows },
    { results: teamRows },
    { results: userRows },
    { results: inviteRows },
    { results: activeJobs },
  ] = await Promise.all([
      db.prepare("SELECT id, name FROM departments").all<{ id: string; name: string }>(),
      db
        .prepare("SELECT id, name, managerId, departmentId, pendingManagerEmail FROM teams")
        .all<{ id: string; name: string; managerId: string | null; departmentId: string | null; pendingManagerEmail: string | null }>(),
      db
        .prepare(
          `SELECT u.id, lower(u.email) AS email,
                  EXISTS(SELECT 1 FROM user_roles ur WHERE ur.userId = u.id AND ur.role = 'manager') AS isManager
             FROM user u`,
        )
        .all<{ id: string; email: string; isManager: number }>(),
      db
        .prepare("SELECT id, lower(email) AS email, lower(employeeId) AS employeeId, name FROM invites WHERE status = 'pending'")
        .all<{ id: string; email: string; employeeId: string | null; name: string | null }>(),
      db
        .prepare(
          `SELECT e.userId, lower(e.employeeId) AS employeeId, u.name
             FROM employment e JOIN user u ON u.id = e.userId
            WHERE e.status = 'active'`,
        )
        .all<{ userId: string; employeeId: string | null; name: string }>(),
    ]);
  const deptId = new Map(deptRows.map((d) => [d.name.trim().toLowerCase(), d.id]));
  const teamByName = new Map(teamRows.map((t) => [t.name.trim().toLowerCase(), t]));
  const userByEmail = new Map(userRows.map((u) => [u.email, u]));
  const userById = new Map(userRows.map((u) => [u.id, u]));
  const inviteByEmail = new Map(inviteRows.map((i) => [i.email, i.id]));
  const userIdByEmployeeId = new Map(
    activeJobs.filter((j) => j.employeeId).map((j) => [j.employeeId!, j.userId]),
  );
  const inviteByEmployeeId = new Map(
    inviteRows.filter((i) => i.employeeId).map((i) => [i.employeeId!, i.id]),
  );
  const matchedUsers = new Set<string>();
  const matchedInvites = new Set<string>();

  const stmts: D1PreparedStatement[] = [];

  // ── 4. Departments ────────────────────────────────────────────────────────
  const ensureDept = (name: string): string | null => {
    if (!name) return null;
    const key = name.toLowerCase();
    let id = deptId.get(key);
    if (!id) {
      id = `dept-${crypto.randomUUID().slice(0, 8)}`;
      deptId.set(key, id);
      stmts.push(db.prepare("INSERT INTO departments (id, name) VALUES (?, ?)").bind(id, name));
      notes.push(`New department: ${name}.`);
    }
    return id;
  };

  // ── 5. Teams and their leaders ────────────────────────────────────────────
  const teamId = new Map<string, string>(); // roster key → team id
  for (const [key, team] of teams) {
    const departmentId = ensureDept(team.department);
    const existing = teamByName.get(key);
    let id: string;
    let managerId = existing?.managerId ?? null;
    let pending = existing?.pendingManagerEmail ?? null;
    if (team.leader) {
      const leaderUser = userByEmail.get(team.leader);
      const currentEmail = managerId ? userById.get(managerId)?.email : undefined;
      if (currentEmail === team.leader) {
        pending = null; // already leads it
      } else if (leaderUser?.isManager) {
        managerId = leaderUser.id;
        pending = null;
        notes.push(`${nameOf(team.leader)} now leads ${team.name}.`);
      } else {
        pending = team.leader;
        notes.push(
          leaderUser
            ? `${nameOf(team.leader)} will lead ${team.name} — approve them in People & roles.`
            : `${nameOf(team.leader)} will lead ${team.name} once they sign up and you approve them.`,
        );
      }
    }
    if (existing) {
      id = existing.id;
      stmts.push(
        db
          .prepare("UPDATE teams SET departmentId = COALESCE(?, departmentId), managerId = ?, pendingManagerEmail = ? WHERE id = ?")
          .bind(departmentId, managerId, pending, id),
      );
    } else {
      id = `team-${crypto.randomUUID().slice(0, 8)}`;
      stmts.push(
        db
          .prepare("INSERT INTO teams (id, name, managerId, departmentId, pendingManagerEmail) VALUES (?, ?, ?, ?, ?)")
          .bind(id, team.name, managerId, departmentId, pending),
      );
      notes.push(`New team: ${team.name}.`);
    }
    teamId.set(key, id);
  }

  // ── 6. People ─────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const leaders = new Set([...teams.values()].map((t) => t.leader).filter(Boolean));
  for (const r of rows) {
    const key = memberOf.get(r.email) ?? null;
    const tId = key ? teamId.get(key)! : null;
    // The person's own department column wins; otherwise they take their team's.
    const dId = ensureDept(r.department) || (key ? ensureDept(teams.get(key)!.department) : null);
    // Match by employee ID first (it survives an email change), then email.
    // If the two point at different people, the file contradicts itself —
    // skip the row rather than guess.
    const idKey = r.employeeId.toLowerCase();
    const byIdUser = idKey ? userIdByEmployeeId.get(idKey) : undefined;
    const byEmailUser = userByEmail.get(r.email)?.id;
    const byIdInvite = idKey ? inviteByEmployeeId.get(idKey) : undefined;
    const byEmailInvite = inviteByEmail.get(r.email);
    if ((byIdUser && byEmailUser && byIdUser !== byEmailUser) || (byIdInvite && byEmailInvite && byIdInvite !== byEmailInvite)) {
      result.skipped++;
      result.errors.push(
        `Row ${r.rowNo} (${r.email}): employee ID ${r.employeeId} already belongs to someone else in the app — skipped.`,
      );
      continue;
    }
    const userId = byIdUser ?? byEmailUser;
    if (userId) {
      matchedUsers.add(userId);
      // Update their CURRENT job in place (existing rows can have any id, so
      // match on userId); only create one if they have no active job at all.
      stmts.push(
        db
          .prepare(
            `UPDATE employment SET teamId = ?, departmentId = ?, grade = ?,
                    employeeId = COALESCE(?, employeeId)
              WHERE userId = ? AND status = 'active'`,
          )
          .bind(tId, dId, r.grade || null, r.employeeId || null, userId),
        db
          .prepare(
            `INSERT INTO employment (id, userId, teamId, departmentId, grade, employeeId, status, startedAt, workEmail, workEmailVerified)
             SELECT ?, ?, ?, ?, ?, ?, 'active', ?, ?, 1
              WHERE NOT EXISTS (SELECT 1 FROM employment WHERE userId = ? AND status = 'active')
             ON CONFLICT(id) DO UPDATE SET teamId = excluded.teamId, departmentId = excluded.departmentId,
                                            grade = excluded.grade, employeeId = excluded.employeeId,
                                            status = 'active', endedAt = NULL`,
          )
          .bind(`emp-${userId.slice(0, 8)}`, userId, tId, dId, r.grade || null, r.employeeId || null, today, r.email, userId),
        db.prepare("UPDATE user SET teamId = ?, departmentId = ? WHERE id = ?").bind(tId, dId, userId),
      );
      if (byIdUser && byEmailUser === undefined) {
        notes.push(`${r.name || r.email}: matched by employee ID; the email in the file differs from the one they sign in with.`);
      }
      result.linked!++;
      continue;
    }
    const role = leaders.has(r.email) ? "manager" : "employee";
    const existingInvite = byIdInvite ?? byEmailInvite;
    if (existingInvite) {
      matchedInvites.add(existingInvite);
      stmts.push(
        db
          .prepare(
            `UPDATE invites SET email = ?, name = ?, grade = ?, role = ?, teamId = ?, departmentId = ?,
                    employeeId = COALESCE(?, employeeId), createdAt = datetime('now')
              WHERE id = ?`,
          )
          .bind(r.email, r.name || null, r.grade || null, role, tId, dId, r.employeeId || null, existingInvite),
      );
      result.updated++;
    } else {
      stmts.push(
        db
          .prepare(
            `INSERT INTO invites (id, email, name, grade, employeeId, role, invitedBy, teamId, departmentId, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          )
          .bind(
            `inv-${crypto.randomUUID().slice(0, 8)}`,
            r.email,
            r.name || null,
            r.grade || null,
            r.employeeId || null,
            role,
            session.id,
            tId,
            dId,
          ),
      );
      result.created++;
    }
  }

  // Listed, never removed: whether they've left is the admin's call.
  const missing = [
    ...activeJobs.filter((j) => !matchedUsers.has(j.userId)).map((j) => j.name),
    ...inviteRows.filter((i) => !matchedInvites.has(i.id)).map((i) => i.name || i.email),
  ];
  if (missing.length > 0) {
    const shown = missing.slice(0, 10).join(", ");
    notes.push(
      `In the app but not in this file (${missing.length}): ${shown}${missing.length > 10 ? ", …" : ""}. Nothing was changed for them — mark them as resigned in People if they've left.`,
    );
  }

  // A person the file names as leading two teams only sees one on their
  // dashboard today — flag it rather than let it pass silently.
  for (const email of leaders) {
    const led = [...teams.values()].filter((t) => t.leader === email).map((t) => t.name);
    if (led.length > 1) {
      notes.push(`${nameOf(email!)} leads ${led.join(" and ")} — their dashboard currently shows only one team.`);
    }
  }

  stmts.push(
    auditStmt(db, session.id, "roster_upload", "roster", null, {
      added: result.created,
      updated: result.updated,
      linked: result.linked,
      skipped: result.skipped,
    }),
  );
  await db.batch(stmts);
  return result;
}
