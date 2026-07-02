/**
 * Real career history + company detail (mock→D1 slice 9). SERVER-ONLY.
 * Own-data only. The current company links to LIVE data (reusing the employee
 * aggregation); past companies are FROZEN self-reported snapshots from
 * careerCompanies.
 */

import { getDB } from "./db";
import { assertOwner } from "./access-control";
import { getEmployeeScores } from "./scores";
import type {
  CareerCompanySummary,
  CareerHistory,
  CompanyDetail,
  CompanyPillarScore,
  CompanyQuestionScore,
} from "./data";
import { PILLARS, PILLAR_ORDER } from "./pillars";
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
    return {
      id: CURRENT_ID,
      company: emp.companyName ?? "Current company",
      role: emp.designation ?? "—",
      period: `${ym(emp.startedAt)} – Present`,
      current: true,
      overallScore: live.overall ?? 0,
      frozenAt: "Live data",
      participationPct: live.participation,
      pillars: live.pillars
        .filter((p) => p.score !== null)
        .map((p) => ({ pillarId: p.pillarId, label: PILLARS[p.pillarId].label, score: p.score as number })),
      strengths: sorted.slice(0, 3).map((q) => ({ text: q.text, score: q.score })),
      concerns: sorted.slice(-3).reverse().map((q) => ({ text: q.text, score: q.score })),
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

  const pillars: CompanyPillarScore[] = PILLAR_ORDER.filter((pid) => pid in pillarScores).map(
    (pid) => ({ pillarId: pid as PillarId, label: PILLARS[pid].label, score: pillarScores[pid] }),
  );

  return {
    id: c.id,
    company: c.name,
    role: c.role ?? "—",
    period: `${ym(c.startDate)} – ${ym(c.endDate)}`,
    current: false,
    overallScore: c.overallScore ?? 0,
    frozenAt: ym(c.endDate),
    participationPct: q.participationPct ?? 0,
    pillars,
    strengths: q.strengths ?? [],
    concerns: q.concerns ?? [],
  };
}
