/**
 * Real profile header + activity summary (mock→D1 slice 6). SERVER-ONLY.
 * Own-data only (assertOwner). Reuses the employee aggregation for the score.
 */

import { getDB } from "./db";
import { assertOwner } from "./access-control";
import { getEmployeeScores } from "./scores";
import type { ProfileStats } from "./data";
import type { SessionUser } from "./types";

/** "5 yrs 1 mo" from a whole number of months. */
function formatTenure(totalMonths: number): string {
  if (totalMonths <= 0) return "—";
  const yrs = Math.floor(totalMonths / 12);
  const mos = totalMonths % 12;
  const parts: string[] = [];
  if (yrs) parts.push(`${yrs} yr${yrs === 1 ? "" : "s"}`);
  if (mos) parts.push(`${mos} mo${mos === 1 ? "" : "s"}`);
  return parts.join(" ") || "0 mos";
}

function monthsBetween(startISO: string | null, endISO: string | null): number {
  if (!startISO) return 0;
  const start = new Date(startISO);
  const end = endISO ? new Date(endISO) : new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const m = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(0, m);
}

export async function getProfileStats(
  session: SessionUser,
  userId: string,
): Promise<ProfileStats> {
  assertOwner(session, userId);
  const db = getDB();

  const [emp, streak, totalRow, badgeRes, winRes, answeredRes, totalWin, career] =
    await Promise.all([
      db
        .prepare(
          "SELECT companyName, designation, startedAt FROM employment WHERE userId = ? AND status = 'active' ORDER BY startedAt DESC LIMIT 1",
        )
        .bind(userId)
        .first<{ companyName: string | null; designation: string | null; startedAt: string | null }>(),
      db
        .prepare("SELECT currentStreak, longestStreak FROM streaks WHERE userId = ?")
        .bind(userId)
        .first<{ currentStreak: number; longestStreak: number }>(),
      db.prepare("SELECT COUNT(*) AS n FROM checkIns WHERE userId = ?").bind(userId).first<{ n: number }>(),
      db.prepare("SELECT badge FROM user_badges WHERE userId = ?").bind(userId).all<{ badge: string }>(),
      db.prepare("SELECT weekId FROM weeklyWindows ORDER BY startDate DESC LIMIT 10").all<{ weekId: string }>(),
      db.prepare("SELECT DISTINCT weekId FROM checkIns WHERE userId = ?").bind(userId).all<{ weekId: string }>(),
      db.prepare("SELECT COUNT(*) AS n FROM weeklyWindows").first<{ n: number }>(),
      db
        .prepare("SELECT startDate, endDate FROM careerCompanies WHERE userId = ?")
        .bind(userId)
        .all<{ startDate: string | null; endDate: string | null }>(),
    ]);

  const scores = await getEmployeeScores(session, userId, "3M");

  const answered = new Set(answeredRes.results.map((r) => r.weekId));
  const recentWeeks = winRes.results.map((w) => answered.has(w.weekId)).reverse(); // oldest → newest
  const participationPct = totalWin?.n ? Math.round((answered.size / totalWin.n) * 100) : 0;

  const tenureMonths =
    monthsBetween(emp?.startedAt ?? null, null) +
    career.results.reduce((sum, c) => sum + monthsBetween(c.startDate, c.endDate), 0);

  return {
    role: emp?.designation ?? null,
    company: emp?.companyName ?? null,
    overallScore: scores.overall ?? 0,
    delta: scores.delta ?? 0,
    streak: streak?.currentStreak ?? 0,
    longestStreak: streak?.longestStreak ?? 0,
    totalCheckIns: totalRow?.n ?? 0,
    participationPct,
    recentWeeks,
    badges: badgeRes.results.map((b) => b.badge),
    careerTenure: formatTenure(tenureMonths),
  };
}
