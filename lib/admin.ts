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
  Invite,
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

// ─────────────────────────────────────────────────────────────────────────────
// Invites (Phase 4.4). Admin invites managers / individuals, optionally onto a
// team, and can bulk-import from CSV. Records + UI are built now; the actual
// email SEND is intentionally stubbed until the email service (Resend) key is
// configured — that step is the owner's (see the TODO(email) markers).
// ─────────────────────────────────────────────────────────────────────────────

/** An invite enriched with its team name for the admin list. */
export interface InviteWithMeta extends Invite {
  teamName: string | null;
}

interface InviteRow extends Invite {
  teamName: string | null;
}

/** The editable fields of an invite. `role` uses the DB values (employee/manager). */
export interface InviteInput {
  email: string;
  role: "manager" | "employee";
  teamId: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalise a role cell: accept "individual" as a friendly alias for employee. */
function normaliseRole(raw: string): "manager" | "employee" | null {
  const r = raw.trim().toLowerCase();
  if (r === "manager") return "manager";
  if (r === "employee" || r === "individual") return "employee";
  return null;
}

/** All invites, newest first, each with its team name. Admin only. */
export async function getInvites(session: SessionUser): Promise<InviteWithMeta[]> {
  assertRole(session, "admin");
  const { results } = await getDB()
    .prepare(
      `SELECT i.id, i.email, i.role, i.invitedBy, i.teamId, i.status, i.createdAt,
              t.name AS teamName
         FROM invites i
         LEFT JOIN teams t ON t.id = i.teamId
        ORDER BY i.createdAt DESC`,
    )
    .all<InviteRow>();
  return results;
}

/**
 * Create an invite. If a *pending* invite already exists for the same email we
 * reuse it (refresh its role/team + timestamp) rather than duplicating. Returns
 * whether a new row was created. Admin only.
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
  const existing = await db
    .prepare("SELECT id FROM invites WHERE lower(email) = ? AND status = 'pending'")
    .bind(email)
    .first<{ id: string }>();
  if (existing) {
    await db
      .prepare("UPDATE invites SET role = ?, teamId = ?, createdAt = datetime('now') WHERE id = ?")
      .bind(input.role, input.teamId || null, existing.id)
      .run();
    return { created: false };
  }
  const id = `inv-${crypto.randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      "INSERT INTO invites (id, email, role, invitedBy, teamId, status) VALUES (?, ?, ?, ?, ?, 'pending')",
    )
    .bind(id, email, input.role, session.id, input.teamId || null)
    .run();
  // TODO(email): send the invite email here once the Resend key is configured.
  return { created: true };
}

/** "Resend" a pending invite — refreshes its timestamp (and, later, re-sends the email). */
export async function resendInvite(session: SessionUser, id: string): Promise<void> {
  assertRole(session, "admin");
  await getDB()
    .prepare("UPDATE invites SET createdAt = datetime('now') WHERE id = ? AND status = 'pending'")
    .bind(id)
    .run();
  // TODO(email): re-send the invite email here once the Resend key is configured.
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

/**
 * Bulk-import invites from raw CSV text. Expected columns: `email`, `role`,
 * `team` (team is optional; role accepts "manager"/"individual"/"employee").
 * A header row is auto-detected. Malformed rows are skipped with a message and
 * the valid rows still import; an unknown team name is flagged but the invite is
 * still created (unassigned) rather than crashing the whole import. Admin only.
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

  // Team-name → id lookup (case-insensitive) for the optional team column.
  const { results: teamRows } = await db.prepare("SELECT id, name FROM teams").all<{
    id: string;
    name: string;
  }>();
  const teamByName = new Map(teamRows.map((t) => [t.name.trim().toLowerCase(), t.id]));

  // Detect a header row (contains an "email" cell); otherwise assume email,role,team.
  let cols = { email: 0, role: 1, team: 2 };
  let start = 0;
  const firstCells = splitCsvLine(lines[0]).map((c) => c.trim().toLowerCase());
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
