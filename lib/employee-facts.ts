/**
 * The employee dashboard's AI insight card. SERVER-ONLY (calls getDB and reads
 * the GROQ_API_KEY secret). Own data only (assertOwner) — never an aggregate,
 * so no anonymisation floor applies.
 *
 * Code decides what the card says (lib/insight-signals.ts picks one or two
 * facts from this person's real answers); the AI only rewords those facts into
 * one smooth line. Any AI failure, or a reply that drifts into advice, falls
 * back to the plain sentences — the card never blocks the dashboard and never
 * says anything the answers don't back up.
 *
 * Kept as its own module, not inlined into lib/ai.ts, to avoid a circular
 * import: lib/career.ts imports getCareerInsight from lib/ai.ts, and this
 * module needs careerFacts from lib/career.ts.
 */

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "./db";
import { assertOwner } from "./access-control";
import { careerFacts, hasAnyCareerHistory } from "./career";
import { callGroq, writeCache } from "./ai";
import { visibleAffectedActions } from "./feedback";
import { PILLAR_ORDER } from "./pillars";
import {
  aiReplyOk,
  INSIGHT_SYSTEM_PROMPT,
  angleSheet,
  findAngles,
  monthsBetween,
  planInsight,
  type AnswerHistory,
  type CareerJob,
  type EmployeeInsightCard,
  type SignalInput,
} from "./insight-signals";
import type { QuestionOptionCols } from "./responses";
import type { EmployeeScores, Window } from "./data";
import type { PillarId, SessionUser } from "./types";

function sinceLabel(iso: string): string {
  const d = new Date(iso.replace(" ", "T"));
  if (isNaN(d.getTime())) return "recently";
  const days = Math.round((Date.now() - d.getTime()) / 864e5);
  if (days < 7) return "this week";
  if (days < 14) return "last week";
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

/** The most recent manager action this person can see, and whether their
 *  answers in that pillar went up after it. */
async function priorActionFact(userId: string): Promise<SignalInput["priorAction"]> {
  const db = getDB();
  const affected = await visibleAffectedActions(db, userId);
  const latest = [...affected].sort((a, b) =>
    (b.visibleToEmployeesAt ?? "").localeCompare(a.visibleToEmployeesAt ?? ""),
  )[0];
  if (!latest?.visibleToEmployeesAt) return null;
  const [before, after] = await Promise.all([
    db
      .prepare("SELECT AVG(score) AS avg FROM checkIns WHERE userId = ? AND pillarId = ? AND timestamp < ?")
      .bind(userId, latest.pillarId, latest.visibleToEmployeesAt)
      .first<{ avg: number | null }>(),
    db
      .prepare("SELECT AVG(score) AS avg FROM checkIns WHERE userId = ? AND pillarId = ? AND timestamp >= ?")
      .bind(userId, latest.pillarId, latest.visibleToEmployeesAt)
      .first<{ avg: number | null }>(),
  ]);
  if (before?.avg == null || after?.avg == null) return null; // too soon to say
  return {
    pillarId: latest.pillarId,
    sinceLabel: sinceLabel(latest.visibleToEmployeesAt),
    movedUp: after.avg > before.avg,
  };
}

/** Pillars where this job is strictly the best or worst across their career. */
async function careerExtremes(userId: string, scores: EmployeeScores): Promise<SignalInput["careerExtremes"]> {
  const emp = await getDB()
    .prepare("SELECT companyName FROM employment WHERE userId = ? AND status = 'active' ORDER BY startedAt DESC LIMIT 1")
    .bind(userId)
    .first<{ companyName: string | null }>();
  const companies = await careerFacts(userId, { name: emp?.companyName ?? "Current company", scores });
  const current = companies.find((c) => c.current);
  if (!current || companies.length < 2) return [];

  const out: SignalInput["careerExtremes"] = [];
  for (const pid of PILLAR_ORDER) {
    const mine = current.pillars.find((p) => p.pillarId === pid)?.score;
    const others = companies
      .filter((c) => !c.current)
      .map((c) => c.pillars.find((p) => p.pillarId === pid)?.score)
      .filter((s): s is number => s !== undefined);
    if (mine === undefined || others.length === 0) continue;
    if (mine > Math.max(...others)) out.push({ pillarId: pid, kind: "best" });
    else if (mine < Math.min(...others)) out.push({ pillarId: pid, kind: "worst" });
  }
  return out;
}

export async function getEmployeeInsight(
  session: SessionUser,
  userId: string,
  window: Window,
  scores: EmployeeScores,
): Promise<EmployeeInsightCard | null> {
  assertOwner(session, userId);
  if (!scores.enoughData || scores.overall === null || scores.trend.length === 0) return null;

  try {
    const db = getDB();
    const [ciRes, qRes, hasCareer, priorAction, extremes, emp, jobRes] = await Promise.all([
      db
        .prepare("SELECT questionId, weekId, score FROM checkIns WHERE userId = ? ORDER BY timestamp, weekId")
        .bind(userId)
        .all<{ questionId: string; weekId: string; score: number }>(),
      db
        .prepare(
          "SELECT id, text, pillarId, optionA_text, optionA_score, optionB_text, optionB_score, optionC_text, optionC_score FROM questions",
        )
        .all<{ id: string; text: string; pillarId: PillarId } & QuestionOptionCols>(),
      hasAnyCareerHistory(session, userId),
      priorActionFact(userId),
      careerExtremes(userId, scores),
      db
        .prepare(
          `SELECT e.companyName, e.designation, e.grade, e.startedAt, d.name AS department
             FROM employment e LEFT JOIN departments d ON d.id = e.departmentId
            WHERE e.userId = ? AND e.status = 'active' ORDER BY e.startedAt DESC LIMIT 1`,
        )
        .bind(userId)
        .first<{
          companyName: string | null;
          designation: string | null;
          grade: string | null;
          startedAt: string | null;
          department: string | null;
        }>(),
      db
        .prepare("SELECT name, role, startDate, endDate, overallScore, pillarScores FROM careerCompanies WHERE userId = ?")
        .bind(userId)
        .all<{
          name: string;
          role: string | null;
          startDate: string | null;
          endDate: string | null;
          overallScore: number | null;
          pillarScores: string | null;
        }>(),
    ]);

    // Same weeks the dashboard is showing (the window's trend weeks).
    const weekIndex = new Map(scores.trend.map((t, i) => [t.weekId, i]));
    const lastIndex = scores.trend.length - 1;
    const qMeta = new Map(qRes.results.map((q) => [q.id, q]));
    const byQ = new Map<string, AnswerHistory>();
    for (const r of ciRes.results) {
      const wi = weekIndex.get(r.weekId);
      const q = qMeta.get(r.questionId);
      if (wi === undefined || !q) continue;
      let h = byQ.get(q.id);
      if (!h) {
        h = {
          questionId: q.id,
          text: q.text,
          pillarId: q.pillarId,
          options: [
            { text: q.optionA_text, score: q.optionA_score },
            { text: q.optionB_text, score: q.optionB_score },
            { text: q.optionC_text, score: q.optionC_score },
          ],
          answers: [],
          weeksAgo: lastIndex,
        };
        byQ.set(q.id, h);
      }
      h.answers.push(r.score);
      h.weeksAgo = Math.min(h.weeksAgo, lastIndex - wi);
    }

    const plan = planInsight({
      firstName: (session.name || "there").trim().split(/\s+/)[0],
      overall: scores.overall,
      delta: scores.delta,
      trend: scores.trend,
      history: [...byQ.values()],
      hasCareerHistory: hasCareer,
      priorAction,
      careerExtremes: extremes,
    });
    if (plan.facts.length === 0) return null;

    const card = (text: string): EmployeeInsightCard => ({
      eyebrow: plan.eyebrow,
      text,
      foot: plan.foot,
      footHref: plan.footHref,
    });

    const pastJobs: CareerJob[] = jobRes.results.map((j) => {
      let pillars: CareerJob["pillars"] = {};
      try {
        pillars = j.pillarScores ? JSON.parse(j.pillarScores) : {};
      } catch {
        // a malformed row just contributes no pillar scores
      }
      return {
        name: j.name,
        role: j.role,
        months: monthsBetween(j.startDate, j.endDate),
        overall: j.overallScore,
        pillars,
      };
    });
    const sheetInput = {
      history: [...byQ.values()],
      pillars: Object.fromEntries(scores.pillars.map((p) => [p.pillarId, p.score])),
      overall: scores.overall,
      weeks: scores.trend.length,
      profile: {
        designation: emp?.designation ?? null,
        grade: emp?.grade ?? null,
        department: emp?.department ?? null,
        company: emp?.companyName ?? null,
        months: monthsBetween(emp?.startedAt ?? null),
      },
      pastJobs,
      priorAction,
    };
    const angles = findAngles(sheetInput);
    // A sharp week-over-week move always leads (the card's heading says so too).
    if (plan.changed) {
      angles.unshift({
        weight: 100,
        fact: plan.facts.join(" "),
        meaning: "A sharp move in a single week usually means something specific happened, not a gradual drift.",
      });
    }
    // No pattern strong enough for the AI: the plain "what's happening" line.
    if (angles.length === 0) return card(plan.facts.join(" "));
    const sheet = angleSheet(sheetInput, angles);


    // Reuse the AI's wording while the facts are unchanged.
    const fingerprint = sheet;
    const id = `employee:${userId}|${window}`;
    const cached = await db
      .prepare("SELECT fingerprint, text FROM aiInsights WHERE id = ?")
      .bind(id)
      .first<{ fingerprint: string; text: string }>();
    if (cached && cached.fingerprint === fingerprint) return card(cached.text);

    const apiKey = getRequestContext().env.GROQ_API_KEY;
    const plain = angles[0].fact;
    if (!apiKey) return card(plain);

    const text = await callGroq(apiKey, INSIGHT_SYSTEM_PROMPT, sheet, {
      reasoningEffort: "low",
      maxTokens: 700,
      timeoutMs: 12000,
    }).catch(() => null);
    if (!text || !aiReplyOk(text, sheet)) return card(plain);

    await writeCache(id, fingerprint, text);
    return card(text);
  } catch {
    return null; // the card shows its fallback line; the dashboard is never blocked
  }
}
