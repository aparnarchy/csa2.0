/**
 * Real career history + company detail (mock→D1 slice 9). SERVER-ONLY.
 * Own-data only. The current company links to LIVE data (reusing the employee
 * aggregation); past companies are FROZEN self-reported snapshots from
 * careerCompanies.
 */

import { getDB } from "./db";
import { assertOwner } from "./access-control";
import { getEmployeeScores } from "./scores";
import { getCareerInsight, type CareerCompanyFacts } from "./ai";
import type {
  CareerCompanySummary,
  CareerHistory,
  CompanyDetail,
  CompanyQuestionScore,
  EmployeeScores,
  PillarScore,
  QuestionInsight,
} from "./data";
import { PILLAR_ORDER } from "./pillars";
import type { PillarId, SessionUser } from "./types";

const CURRENT_ID = "current";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
function ym(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T"));
  if (isNaN(d.getTime())) return "";
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function monthsBetween(a: string | null, b: string | null): number {
  if (!a) return 0;
  const s = new Date(a);
  const e = b ? new Date(b) : new Date();
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  return Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function tenure(months: number): string {
  if (months <= 0) return "—";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} yr${y === 1 ? "" : "s"}` : "", m ? `${m} mo${m === 1 ? "" : "s"}` : ""]
    .filter(Boolean)
    .join(" ") || "0 mos";
}

interface CareerRow {
  id: string;
  name: string;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
  overallScore: number | null;
  pillarScores: string | null;
  questionnaire: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// The career questionnaire — the questions, and the write that turns a set of
// answers into one frozen past-company snapshot.
// ─────────────────────────────────────────────────────────────────────────────

export interface CareerQuestion {
  id: string;
  text: string;
  pillarId: PillarId;
  options: { key: string; text: string; score: number }[];
}

interface CareerQuestionRow {
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

/**
 * The career questionnaire, in sheet order. Deliberately a different table from
 * the weekly check-in bank — these ask about a past company in the past tense.
 */
export async function getCareerQuestions(): Promise<CareerQuestion[]> {
  const { results } = await getDB()
    .prepare(
      `SELECT id, text, pillarId, optionA_text, optionA_score, optionB_text, optionB_score,
              optionC_text, optionC_score
         FROM careerQuestions WHERE isActive = 1 ORDER BY sortOrder`,
    )
    .all<CareerQuestionRow>();

  return results.map((q) => ({
    id: q.id,
    text: q.text,
    pillarId: q.pillarId,
    options: [
      { key: "A", text: q.optionA_text, score: q.optionA_score },
      { key: "B", text: q.optionB_text, score: q.optionB_score },
      { key: "C", text: q.optionC_text, score: q.optionC_score },
    ],
  }));
}

export interface AddCareerCompanyInput {
  name: string;
  role: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  /** questionId → chosen option key ("A" | "B" | "C") */
  answers: Record<string, string>;
}

/**
 * Turns one completed questionnaire into a `careerCompanies` row.
 *
 * Scoring: each pillar is the mean of its own questions, and the overall is the
 * mean of the four PILLAR scores — not of all seven answers. Pillar coverage is
 * uneven (Culture has 3 questions, Growth and Compensation 1 each), so a raw
 * mean over answers would silently weight Culture 3x.
 */
export async function addCareerCompany(
  session: SessionUser,
  userId: string,
  input: AddCareerCompanyInput,
): Promise<string> {
  assertOwner(session, userId);

  const name = input.name.trim();
  if (!name) throw new Error("Company name is required.");
  if (!input.startDate || !input.endDate) throw new Error("Start and end dates are required.");
  if (new Date(input.endDate) <= new Date(input.startDate)) {
    throw new Error("The end date must be after the start date.");
  }

  const questions = await getCareerQuestions();
  if (questions.length === 0) throw new Error("No career questions are configured.");

  // Resolve each answer to its score, failing loudly on a missing or unknown one
  // rather than quietly scoring it zero.
  const scored = questions.map((q) => {
    const key = input.answers[q.id];
    const option = q.options.find((o) => o.key === key);
    if (!option) throw new Error(`Missing an answer for "${q.text}".`);
    return { id: q.id, text: q.text, pillarId: q.pillarId, score: option.score };
  });

  const pillarScores: Record<string, number> = {};
  for (const pid of PILLAR_ORDER) {
    const forPillar = scored.filter((s) => s.pillarId === pid);
    if (forPillar.length === 0) continue;
    pillarScores[pid] = round1(forPillar.reduce((sum, s) => sum + s.score, 0) / forPillar.length);
  }

  const pillarValues = Object.values(pillarScores);
  const overallScore = round1(pillarValues.reduce((sum, v) => sum + v, 0) / pillarValues.length);

  // Same top-3 / bottom-3 shape the "current company" branch produces, so the
  // detail screen renders past and present identically. id and pillarId are
  // stored too so the read side can rebuild question rows without re-querying
  // the question bank (which may have been edited since).
  const byScore = [...scored].sort((a, b) => b.score - a.score);
  const questionnaire = {
    strengths: byScore.slice(0, 3),
    concerns: byScore.slice(-3).reverse(),
  };

  const id = `cc-${crypto.randomUUID().slice(0, 8)}`;
  await getDB()
    .prepare(
      `INSERT INTO careerCompanies
         (id, userId, name, role, startDate, endDate, overallScore, pillarScores, questionnaire)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      userId,
      name,
      input.role.trim() || null,
      input.startDate,
      input.endDate,
      overallScore,
      JSON.stringify(pillarScores),
      JSON.stringify(questionnaire),
    )
    .run();

  return id;
}

/**
 * Removes one past company from the history.
 *
 * Only questionnaire rows can be removed. The current company is read from
 * `employment`, not from this table, so there is nothing here to delete and the
 * attempt is refused rather than silently doing nothing.
 *
 * `assertOwner` establishes who is asking; the `userId` in the WHERE clause is
 * what actually protects the row, so a guessed id can't reach anyone else's
 * history. A delete that matches nothing is reported rather than swallowed —
 * it means the id was wrong or the row was already gone.
 */
export async function deleteCareerCompany(
  session: SessionUser,
  userId: string,
  companyId: string,
): Promise<void> {
  assertOwner(session, userId);
  if (companyId === CURRENT_ID) {
    throw new Error("Your current company can't be removed from your history.");
  }

  const db = getDB();
  const res = await db
    .prepare("DELETE FROM careerCompanies WHERE id = ? AND userId = ?")
    .bind(companyId, userId)
    .run();
  if (!res.meta.changes) throw new Error("That company is no longer in your history.");

  // Bin this company's cached AI insight along with it. The insights written
  // for the OTHER companies mention it too, but those repair themselves: their
  // fingerprint covers every company, so losing one no longer matches and they
  // are regenerated on next view.
  await db
    .prepare("DELETE FROM aiInsights WHERE id = ?")
    .bind(`career:${userId}|${companyId}`)
    .run();
}

export async function getCareerHistory(
  session: SessionUser,
  userId: string,
): Promise<CareerHistory> {
  assertOwner(session, userId);
  const db = getDB();

  const [emp, { results: past }] = await Promise.all([
    db
      .prepare(
        "SELECT companyName, designation, startedAt FROM employment WHERE userId = ? AND status = 'active' ORDER BY startedAt DESC LIMIT 1",
      )
      .bind(userId)
      .first<{ companyName: string | null; designation: string | null; startedAt: string | null }>(),
    db
      .prepare(
        "SELECT id, name, role, startDate, endDate, overallScore FROM careerCompanies WHERE userId = ? ORDER BY endDate DESC",
      )
      .bind(userId)
      .all<CareerRow>(),
  ]);

  const companies: CareerCompanySummary[] = [];
  let totalMonths = 0;

  if (emp) {
    const live = await getEmployeeScores(session, userId, "All");
    const m = monthsBetween(emp.startedAt, null);
    totalMonths += m;
    companies.push({
      id: CURRENT_ID,
      company: emp.companyName ?? "Current company",
      role: emp.designation ?? "—",
      period: `${ym(emp.startedAt)} – Present`,
      tenure: tenure(m),
      overallScore: live.overall ?? 0,
      current: true,
    });
  }

  for (const c of past) {
    const m = monthsBetween(c.startDate, c.endDate);
    totalMonths += m;
    companies.push({
      id: c.id,
      company: c.name,
      role: c.role ?? "—",
      period: `${ym(c.startDate)} – ${ym(c.endDate)}`,
      tenure: tenure(m),
      overallScore: c.overallScore ?? 0,
      current: false,
    });
  }

  const scored = companies.filter((c) => c.overallScore > 0);
  const overall = scored.length
    ? Math.round((scored.reduce((s, c) => s + c.overallScore, 0) / scored.length) * 10) / 10
    : 0;

  return { overall, tenure: tenure(totalMonths), companies };
}

/**
 * Every company on record — past questionnaire rows plus the current job — as
 * bare name/score facts for the AI insight. The insight's whole job is the
 * comparison, so it gets the full history, not just the company being viewed.
 *
 * `current` is passed in rather than fetched here so the live aggregation runs
 * at most once per request.
 */
async function careerFacts(
  userId: string,
  current: { name: string; scores: EmployeeScores } | null,
): Promise<CareerCompanyFacts[]> {
  const { results } = await getDB()
    .prepare("SELECT id, name, overallScore, pillarScores FROM careerCompanies WHERE userId = ?")
    .bind(userId)
    .all<Pick<CareerRow, "id" | "name" | "overallScore" | "pillarScores">>();

  const facts: CareerCompanyFacts[] = [];

  if (current && current.scores.overall !== null) {
    facts.push({
      id: CURRENT_ID,
      name: current.name,
      current: true,
      overall: current.scores.overall,
      pillars: current.scores.pillars
        .filter((p) => p.score !== null)
        .map((p) => ({ pillarId: p.pillarId, score: p.score as number })),
    });
  }

  for (const r of results) {
    if (r.overallScore === null) continue;
    const ps = r.pillarScores ? (JSON.parse(r.pillarScores) as Record<string, number>) : {};
    facts.push({
      id: r.id,
      name: r.name,
      current: false,
      overall: r.overallScore,
      pillars: PILLAR_ORDER.filter((pid) => pid in ps).map((pid) => ({
        pillarId: pid as PillarId,
        score: ps[pid],
      })),
    });
  }

  return facts;
}

export async function getCompanyDetail(
  session: SessionUser,
  userId: string,
  companyId: string,
): Promise<CompanyDetail | null> {
  assertOwner(session, userId);
  const db = getDB();

  // Current company → live data.
  if (companyId === CURRENT_ID) {
    const emp = await db
      .prepare(
        "SELECT companyName, designation, startedAt FROM employment WHERE userId = ? AND status = 'active' ORDER BY startedAt DESC LIMIT 1",
      )
      .bind(userId)
      .first<{ companyName: string | null; designation: string | null; startedAt: string | null }>();
    if (!emp) return null;
    const live = await getEmployeeScores(session, userId, "All");
    const sorted = [...live.questions].sort((a, b) => b.score - a.score);
    const companyName = emp.companyName ?? "Current company";
    const insight = await getCareerInsight(
      userId,
      CURRENT_ID,
      await careerFacts(userId, { name: companyName, scores: live }),
    );
    // Pillars and questions pass through WHOLE — deltas, percentiles, response
    // breakdowns and the trend series are what let this company render the full
    // insights dashboard rather than the reduced questionnaire version.
    return {
      id: CURRENT_ID,
      company: companyName,
      role: emp.designation ?? "—",
      period: `${ym(emp.startedAt)} – Present`,
      current: true,
      overallScore: live.overall ?? 0,
      frozenAt: "Live data",
      participationPct: live.participation,
      delta: live.delta,
      pillars: live.pillars.filter((p) => p.score !== null),
      strengths: sorted.slice(0, 3),
      concerns: sorted.slice(-3).reverse(),
      trend: live.trend,
      insight,
    };
  }

  // Past company → frozen snapshot.
  const c = await db
    .prepare(
      "SELECT id, name, role, startDate, endDate, overallScore, pillarScores, questionnaire FROM careerCompanies WHERE id = ? AND userId = ?",
    )
    .bind(companyId, userId)
    .first<CareerRow>();
  if (!c) return null;

  const pillarScores = c.pillarScores ? (JSON.parse(c.pillarScores) as Record<string, number>) : {};
  const q = c.questionnaire
    ? (JSON.parse(c.questionnaire) as {
        participationPct?: number;
        strengths?: CompanyQuestionScore[];
        concerns?: CompanyQuestionScore[];
      })
    : {};

  // A questionnaire company is one person answering once, so there is no prior
  // period to diff against, no cohort to rank within and no distribution across
  // respondents. Those fields are null/empty by design and the screen omits
  // their blocks — filling them with 0 would render as a real, terrible score.
  const pillars: PillarScore[] = PILLAR_ORDER.filter((pid) => pid in pillarScores).map((pid) => ({
    pillarId: pid as PillarId,
    score: pillarScores[pid],
    delta: null,
    band: null,
    percentile: null,
    responseCount: 1,
  }));

  const toInsight = (row: CompanyQuestionScore, i: number, kind: string): QuestionInsight => ({
    id: row.id ?? `${kind}-${i}`,
    text: row.text,
    pillarId: row.pillarId ?? PILLAR_ORDER[0],
    score: row.score,
    responses: [],
    recommendation: "",
  });

  // The comparison spans the whole career, so the current job is pulled in here
  // too — the extra live aggregation is the cost of comparing a past company
  // against where they work now.
  const emp = await db
    .prepare(
      "SELECT companyName FROM employment WHERE userId = ? AND status = 'active' ORDER BY startedAt DESC LIMIT 1",
    )
    .bind(userId)
    .first<{ companyName: string | null }>();
  const current = emp
    ? {
        name: emp.companyName ?? "Current company",
        scores: await getEmployeeScores(session, userId, "All"),
      }
    : null;
  const insight = await getCareerInsight(userId, c.id, await careerFacts(userId, current));

  return {
    id: c.id,
    company: c.name,
    role: c.role ?? "—",
    period: `${ym(c.startDate)} – ${ym(c.endDate)}`,
    current: false,
    overallScore: c.overallScore ?? 0,
    frozenAt: ym(c.endDate),
    participationPct: q.participationPct ?? 0,
    delta: null,
    pillars,
    strengths: (q.strengths ?? []).map((r, i) => toInsight(r, i, "s")),
    concerns: (q.concerns ?? []).map((r, i) => toInsight(r, i, "c")),
    trend: [],
    insight,
  };
}
