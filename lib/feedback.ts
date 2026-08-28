/**
 * Real feedback-action loop (mock→D1 slice 7). SERVER-ONLY (calls getDB).
 *
 * Two sides of the same tables (managerActions + employeeResponses):
 *  - Manager side: the Action Inbox (open items derived from sub-7 team pillars)
 *    and submitting an action. Aggregates only, ≥3 floor. Submitting sets
 *    visibleToEmployeesAt = now + 4 weeks (MANAGER_ACTION_DELAY_WEEKS).
 *  - Employee side: an employee sees an action ONLY when (a) it's their team,
 *    (b) it's past the 4-week delay, and (c) they personally scored <7 on the
 *    trigger question (they were affected). Enforced here in server code.
 */

import { getDB } from "./db";
import { assertOwner, assertRole } from "./access-control";
import { getSampleRecommendation } from "./data";
import type {
  ActionHistoryItem,
  ActionResponseValue,
  FeedbackAction,
  ManagerActionDecision,
  ManagerActionItem,
  ManagerActionStatus,
  ManagerInbox,
} from "./data";
import { PILLARS, PILLAR_ORDER } from "./pillars";
import { ANONYMISATION_FLOOR } from "./scoring";
import type { PillarId, SessionUser } from "./types";

const DELAY_DAYS = 28; // 4 weeks

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
function monthLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T"));
  if (isNaN(d.getTime())) return "";
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
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
}

/** Real A/B/C split for a question from the team's answers (score → option). */
function distribution(scores: number[], q: QuestionRow): ManagerActionItem["responses"] {
  const opts = [
    { key: "A" as const, text: q.optionA_text, score: q.optionA_score },
    { key: "B" as const, text: q.optionB_text, score: q.optionB_score },
    { key: "C" as const, text: q.optionC_text, score: q.optionC_score },
  ];
  const total = scores.length || 1;
  return opts.map((o) => ({
    key: o.key,
    text: o.text,
    pct: Math.round((scores.filter((s) => s === o.score).length / total) * 100),
  }));
}

type DB = ReturnType<typeof getDB>;

/** Resolve the team the caller manages (or a passed team for elevated roles). */
async function resolveManagedTeam(
  db: DB,
  session: SessionUser,
  teamId: string,
): Promise<string | null> {
  const elevated = session.roles.includes("ceo_hr");
  if (teamId !== "my-team" && elevated) return teamId;
  const t = await db
    .prepare("SELECT id FROM teams WHERE managerId = ? LIMIT 1")
    .bind(session.id)
    .first<{ id: string }>();
  return t?.id ?? null;
}

async function activeWeek(db: DB): Promise<string | null> {
  const r = await db
    .prepare("SELECT weekId FROM weeklyWindows WHERE isActive = 1 ORDER BY weekId DESC LIMIT 1")
    .first<{ weekId: string }>();
  return r?.weekId ?? null;
}

interface ActionRow {
  id: string;
  pillarId: PillarId;
  questionId: string;
  recommendationText: string | null;
  actionText: string | null;
  status: string;
  submittedAt: string | null;
  visibleToEmployeesAt: string | null;
}

export async function getManagerInbox(
  session: SessionUser,
  teamId: string,
): Promise<ManagerInbox> {
  assertRole(session, "manager", "ceo_hr");
  const db = getDB();

  const resolved0: ManagerInbox = {
    reporteeCount: 0,
    enoughReportees: false,
    resolvedPct: 0,
    open: [],
    resolved: [],
  };
  const team = await resolveManagedTeam(db, session, teamId);
  if (!team) return resolved0;

  const reporteeRow = await db
    .prepare("SELECT COUNT(*) AS n FROM employment WHERE teamId = ? AND status = 'active'")
    .bind(team)
    .first<{ n: number }>();
  const reporteeCount = reporteeRow?.n ?? 0;
  if (reporteeCount < ANONYMISATION_FLOOR) return { ...resolved0, reporteeCount };

  const [{ results: qRows }, { results: ciRows }, { results: actRows }] = await Promise.all([
    // Every question ever asked, not just active ones — a question going
    // inactive should stop it being assigned going forward, never erase the
    // real historical signal (or trigger-question text) it already produced.
    db.prepare("SELECT * FROM questions").all<QuestionRow>(),
    db
      .prepare(
        `SELECT c.questionId AS questionId, c.pillarId AS pillarId, c.score AS score, e.userId AS userId
           FROM checkIns c JOIN employment e ON e.id = c.employmentId
          WHERE e.teamId = ? AND e.status = 'active'`,
      )
      .bind(team)
      .all<{ questionId: string; pillarId: PillarId; score: number; userId: string }>(),
    db
      .prepare("SELECT * FROM managerActions WHERE teamId = ?")
      .bind(team)
      .all<ActionRow>(),
  ]);

  const responders = new Set(ciRows.map((r) => r.userId)).size;
  if (ciRows.length < ANONYMISATION_FLOOR || responders < ANONYMISATION_FLOOR) {
    return { ...resolved0, reporteeCount };
  }

  const qById = new Map(qRows.map((q) => [q.id, q]));
  const scoresByQ = new Map<string, number[]>();
  const scoresByPillar = new Map<PillarId, number[]>();
  for (const r of ciRows) {
    (scoresByQ.get(r.questionId) ?? scoresByQ.set(r.questionId, []).get(r.questionId)!).push(r.score);
    (scoresByPillar.get(r.pillarId) ?? scoresByPillar.set(r.pillarId, []).get(r.pillarId)!).push(r.score);
  }

  /** The weakest-scoring question in a pillar (the action's trigger). */
  const weakestQuestion = (pid: PillarId): QuestionRow | null => {
    const candidates = qRows.filter((q) => q.pillarId === pid && scoresByQ.has(q.id));
    if (candidates.length === 0) return null;
    return candidates.sort(
      (a, b) => avg(scoresByQ.get(a.id)!) - avg(scoresByQ.get(b.id)!),
    )[0];
  };

  const actionByPillar = new Map(actRows.map((a) => [a.pillarId, a]));

  // OPEN items: sub-7 pillars without a resolved action. A pillar flagged
  // ("not_yet" → in_progress) shows as status "flagged".
  const open: ManagerActionItem[] = [];
  for (const pid of PILLAR_ORDER) {
    const ps = scoresByPillar.get(pid);
    if (!ps || round1(avg(ps)) >= 7) continue;
    const existing = actionByPillar.get(pid);
    if (existing && existing.status === "resolved") continue;
    const q = weakestQuestion(pid);
    if (!q) continue;
    const qScores = scoresByQ.get(q.id)!;
    open.push({
      id: `open-${pid}`,
      pillarId: pid,
      pillarLabel: PILLARS[pid].label,
      triggerQuestion: q.text,
      teamAvg: round1(avg(qScores)),
      responses: distribution(qScores, q),
      recommendation: getSampleRecommendation(pid).text,
      status: (existing?.status === "in_progress" ? "flagged" : "open") as ManagerActionStatus,
      dateLabel: `Flagged ${monthLabel(new Date().toISOString())}`,
    });
  }
  open.sort((a, b) => a.teamAvg - b.teamAvg);

  // RESOLVED items: submitted actions, with live employee-response counts.
  const resolved: ManagerActionItem[] = [];
  for (const a of actRows.filter((x) => x.status === "resolved")) {
    const q = qById.get(a.questionId);
    const qScores = q ? scoresByQ.get(q.id) ?? [] : [];
    const counts = await db
      .prepare(
        `SELECT
           SUM(CASE WHEN response='yes' THEN 1 ELSE 0 END) AS yes,
           SUM(CASE WHEN response='maybe' THEN 1 ELSE 0 END) AS maybe,
           SUM(CASE WHEN response='not_yet' THEN 1 ELSE 0 END) AS notYet
         FROM employeeResponses WHERE actionId = ?`,
      )
      .bind(a.id)
      .first<{ yes: number; maybe: number; notYet: number }>();
    const visible = a.visibleToEmployeesAt && new Date(a.visibleToEmployeesAt.replace(" ", "T")) <= new Date();
    resolved.push({
      id: a.id,
      pillarId: a.pillarId,
      pillarLabel: PILLARS[a.pillarId].label,
      triggerQuestion: q?.text ?? "",
      teamAvg: qScores.length ? round1(avg(qScores)) : 0,
      responses: q ? distribution(qScores, q) : [],
      recommendation: a.recommendationText ?? getSampleRecommendation(a.pillarId).text,
      status: "resolved",
      dateLabel: `Flagged ${monthLabel(a.submittedAt)}`,
      actionNote: a.actionText ?? undefined,
      submittedAtLabel: `Submitted ${monthLabel(a.submittedAt)}`,
      visibleToEmployeesLabel: visible
        ? `Visible to team since ${monthLabel(a.visibleToEmployeesAt)}`
        : `Visible to team from ${monthLabel(a.visibleToEmployeesAt)}`,
      employeeResponse: {
        yes: counts?.yes ?? 0,
        maybe: counts?.maybe ?? 0,
        notYet: counts?.notYet ?? 0,
      },
    });
  }

  const total = open.length + resolved.length;
  const resolvedPct = total === 0 ? 0 : Math.round((resolved.length / total) * 100);
  return { reporteeCount, enoughReportees: true, resolvedPct, open, resolved };
}

export async function submitManagerAction(
  session: SessionUser,
  input: { itemId: string; decision: ManagerActionDecision; note?: string },
): Promise<void> {
  assertRole(session, "manager", "ceo_hr");
  const db = getDB();
  const team = await resolveManagedTeam(db, session, "my-team");
  if (!team) throw new Error("You don't manage a team.");

  const pid = input.itemId.replace(/^open-/, "") as PillarId;
  if (!PILLAR_ORDER.includes(pid)) throw new Error("Unknown action item.");

  // Recompute the trigger question (weakest in the pillar) for this team —
  // any question ever asked, not just active ones, so this matches whatever
  // was actually shown as the open item (see getManagerInbox above).
  const { results: qRows } = await db
    .prepare("SELECT id, pillarId FROM questions WHERE pillarId = ?")
    .bind(pid)
    .all<{ id: string; pillarId: PillarId }>();
  const { results: ci } = await db
    .prepare(
      `SELECT c.questionId AS questionId, c.score AS score
         FROM checkIns c JOIN employment e ON e.id = c.employmentId
        WHERE e.teamId = ? AND e.status = 'active' AND c.pillarId = ?`,
    )
    .bind(team, pid)
    .all<{ questionId: string; score: number }>();
  const byQ = new Map<string, number[]>();
  for (const r of ci) (byQ.get(r.questionId) ?? byQ.set(r.questionId, []).get(r.questionId)!).push(r.score);
  const ranked = qRows
    .filter((q) => byQ.has(q.id))
    .sort((a, b) => avg(byQ.get(a.id)!) - avg(byQ.get(b.id)!));
  const questionId = ranked[0]?.id ?? qRows[0]?.id;
  if (!questionId) throw new Error("No question to act on for this pillar.");

  const week = (await activeWeek(db)) ?? "";
  const id = `ma-${team}-${pid}`; // one action per pillar per team (idempotent)
  const rec = getSampleRecommendation(pid).text;

  if (input.decision === "yes") {
    const now = new Date();
    const visibleAt = new Date(now.getTime() + DELAY_DAYS * 864e5);
    await db
      .prepare(
        `INSERT OR REPLACE INTO managerActions
           (id, managerId, teamId, pillarId, weekId, questionId, recommendationText, actionText,
            status, submittedAt, visibleToEmployeesAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'resolved', ?, ?)`,
      )
      .bind(id, session.id, team, pid, week, questionId, rec, input.note ?? null,
        now.toISOString(), visibleAt.toISOString())
      .run();
    // Private coaching note for the manager (journal entries are author-only).
    if (input.note?.trim()) {
      await db
        .prepare(
          "INSERT INTO journalEntries (id, userId, weekId, questionId, text, type) VALUES (?, ?, ?, ?, ?, 'coaching')",
        )
        .bind(`je-${crypto.randomUUID().slice(0, 8)}`, session.id, week, questionId, input.note.trim())
        .run();
    }
  } else {
    // "not_yet" → flag for revisit (in_progress), not yet visible to employees.
    await db
      .prepare(
        `INSERT OR REPLACE INTO managerActions
           (id, managerId, teamId, pillarId, weekId, questionId, recommendationText, actionText,
            status, submittedAt, visibleToEmployeesAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'in_progress', NULL, NULL)`,
      )
      .bind(id, session.id, team, pid, week, questionId, rec)
      .run();
  }
}

// ── Employee side ─────────────────────────────────────────────────────────────

interface VisibleAction {
  id: string;
  pillarId: PillarId;
  questionId: string;
  actionText: string | null;
  submittedAt: string | null;
  visibleToEmployeesAt: string | null;
}

/** Actions on the employee's team that are past the delay AND affected them. */
async function visibleAffectedActions(
  db: DB,
  userId: string,
): Promise<VisibleAction[]> {
  const emp = await db
    .prepare("SELECT teamId FROM employment WHERE userId = ? AND status = 'active' ORDER BY startedAt DESC LIMIT 1")
    .bind(userId)
    .first<{ teamId: string | null }>();
  if (!emp?.teamId) return [];

  const { results } = await db
    .prepare(
      `SELECT id, pillarId, questionId, actionText, submittedAt, visibleToEmployeesAt
         FROM managerActions
        WHERE teamId = ? AND status = 'resolved'
          AND visibleToEmployeesAt IS NOT NULL AND visibleToEmployeesAt <= ?`,
    )
    .bind(emp.teamId, new Date().toISOString())
    .all<VisibleAction>();

  // Keep only actions whose trigger question this employee scored < 7 on.
  const affected: VisibleAction[] = [];
  for (const a of results) {
    const hit = await db
      .prepare("SELECT 1 AS x FROM checkIns WHERE userId = ? AND questionId = ? AND score < 7 LIMIT 1")
      .bind(userId, a.questionId)
      .first<{ x: number }>();
    if (hit) affected.push(a);
  }
  return affected;
}

export async function getFeedbackActions(
  session: SessionUser,
  userId: string,
): Promise<FeedbackAction[]> {
  assertOwner(session, userId);
  const db = getDB();
  const actions = await visibleAffectedActions(db, userId);

  const out: FeedbackAction[] = [];
  for (const a of actions) {
    const resp = await db
      .prepare("SELECT response FROM employeeResponses WHERE userId = ? AND actionId = ?")
      .bind(userId, a.id)
      .first<{ response: ActionResponseValue }>();
    if (resp) continue; // already responded → belongs in history
    out.push({
      id: a.id,
      pillarId: a.pillarId,
      pillarLabel: PILLARS[a.pillarId].label,
      actionNote: a.actionText ?? "",
      dateLabel: `Visible since ${monthLabel(a.visibleToEmployeesAt)}`,
      response: null,
    });
  }
  return out;
}

export async function getActionHistory(
  session: SessionUser,
  userId: string,
): Promise<ActionHistoryItem[]> {
  assertOwner(session, userId);
  const db = getDB();
  const actions = await visibleAffectedActions(db, userId);

  const out: ActionHistoryItem[] = [];
  for (const a of actions) {
    const resp = await db
      .prepare("SELECT response, submittedAt FROM employeeResponses WHERE userId = ? AND actionId = ?")
      .bind(userId, a.id)
      .first<{ response: ActionResponseValue; submittedAt: string }>();
    if (!resp) continue;
    out.push({
      id: a.id,
      pillarLabel: PILLARS[a.pillarId].label,
      actionNote: a.actionText ?? "",
      response: resp.response,
      note: null, // anonymous note routing to the manager is a later feature
      respondedAtLabel: monthLabel(resp.submittedAt),
    });
  }
  return out;
}

export async function submitActionResponse(
  session: SessionUser,
  userId: string,
  input: { actionId: string; response: ActionResponseValue; note?: string },
): Promise<void> {
  assertOwner(session, userId);
  const db = getDB();

  // Only allow responding to an action that is actually visible to this employee.
  const allowed = (await visibleAffectedActions(db, userId)).some((a) => a.id === input.actionId);
  if (!allowed) throw new Error("That action isn't available to respond to.");

  await db
    .prepare(
      "INSERT OR REPLACE INTO employeeResponses (id, userId, actionId, response) VALUES (?, ?, ?, ?)",
    )
    .bind(`er-${userId}-${input.actionId}`, userId, input.actionId, input.response)
    .run();

  // Capture the optional note privately for now (author-only journal entry).
  if (input.note?.trim()) {
    await db
      .prepare(
        "INSERT INTO journalEntries (id, userId, text, type) VALUES (?, ?, ?, 'follow_up')",
      )
      .bind(`je-${crypto.randomUUID().slice(0, 8)}`, userId, input.note.trim())
      .run();
  }
}
