/**
 * The single data-access layer. EVERY screen reads through these functions —
 * never directly from the database. Each one runs through the Phase 1
 * access-control guards, so privacy is enforced here in server code.
 *
 * For now these return realistic SAMPLE data so screens can be built and
 * eyeballed. In later phases we swap the *insides* for real D1 queries with
 * no change to the function signatures or the shapes screens consume.
 */

import type { FollowUpStatus, PillarId, SessionUser, WisdomLevel } from "./types";
import { PILLAR_ORDER, PILLARS } from "./pillars";
import {
  assertOwner,
  assertRole,
  enforceAnonymisationFloor,
} from "./access-control";
import { ANONYMISATION_FLOOR, scoreBand, trendDelta, type ScoreResult } from "./scoring";

/** Time filter used by the analysis screens. */
export type Window = "1M" | "3M" | "6M" | "1Y" | "All";
export const WINDOWS: Window[] = ["1M", "3M", "6M", "1Y", "All"];

/** One pillar's headline numbers for a card. */
export interface PillarScore {
  pillarId: PillarId;
  score: number | null;
  delta: number | null;
  band: "green" | "amber" | "red" | null;
  percentile: number | null;
  responseCount: number;
}

/** One survey question with its score and response breakdown (for insights). */
export interface QuestionInsight {
  id: string;
  text: string;
  pillarId: PillarId;
  score: number;
  responses: { key: "A" | "B" | "C"; text: string; pct: number }[];
  recommendation: string;
}

/** The three percentile lenses the score pill cycles through. */
export interface Percentiles {
  org: number;
  dept: number;
  industry: number;
}

/** One point on a trend chart (overall + each pillar + reference lines). */
export interface TrendPoint {
  weekId: string;
  label: string;
  overall: number;
  meaningful_work: number;
  growth: number;
  culture: number;
  compensation: number;
  orgAvg: number;
  deptAvg: number;
  industryAvg: number;
}

/** Everything the employee analysis screen needs. */
export interface EmployeeScores {
  enoughData: boolean;
  overall: number | null;
  delta: number | null;
  percentile: number | null;
  percentiles: Percentiles;
  participation: number; // %
  responseCount: number;
  streak: number;
  pillars: PillarScore[];
  questions: QuestionInsight[];
  trend: TrendPoint[];
}

/** Aggregated team view for a manager (no individuals, ever). */
export interface TeamAggregate {
  enoughData: boolean;
  reason?: string;
  teamScore: number | null;
  delta: number | null;
  participation: number;
  reporteeCount: number;
  pillars: PillarScore[];
  trend: TrendPoint[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic sample-data helpers (replaced by D1 queries later)
// ─────────────────────────────────────────────────────────────────────────────

/** Stable pseudo-random in [0,1) from a string seed — keeps sample data steady. */
function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** How many weeks a window spans (sample approximation). */
function weeksIn(window: Window): number {
  return { "1M": 4, "3M": 13, "6M": 26, "1Y": 52, All: 64 }[window];
}

const RECENT_WEEKS = [
  "2026-W13", "2026-W14", "2026-W15", "2026-W16", "2026-W17", "2026-W18",
  "2026-W19", "2026-W20", "2026-W21", "2026-W22", "2026-W23", "2026-W24",
];

/** Build a believable wavy trend series ending near `target`. */
function buildTrend(seedKey: string, target: number, points: number): TrendPoint[] {
  const weeks = RECENT_WEEKS.slice(-points);
  return weeks.map((weekId, i) => {
    const wobble = (seeded(seedKey + weekId) - 0.5) * 1.6;
    const drift = (i / weeks.length) * 1.2; // gentle improvement over time
    const overall = Math.min(10, Math.max(1, round1(target - 1.2 + drift + wobble)));
    const p = (pid: PillarId, offset: number) =>
      Math.min(10, Math.max(1, round1(overall + offset + (seeded(seedKey + pid + weekId) - 0.5))));
    return {
      weekId,
      label: weekId.replace("2026-", ""),
      overall,
      meaningful_work: p("meaningful_work", 0.4),
      growth: p("growth", -0.6),
      culture: p("culture", 0.8),
      compensation: p("compensation", -0.9),
      orgAvg: round1(6.6 + (seeded("org" + weekId) - 0.5) * 0.4),
      deptAvg: round1(6.9 + (seeded("dept" + weekId) - 0.5) * 0.4),
      industryAvg: 6.2,
    };
  });
}

function pillarScoresFrom(trend: TrendPoint[]): PillarScore[] {
  const last = trend[trend.length - 1];
  const prev = trend.length > 1 ? trend[trend.length - 2] : null;
  return PILLAR_ORDER.map((pillarId) => {
    const score = last[pillarId];
    const delta = prev ? round1(score - prev[pillarId]) : null;
    return {
      pillarId,
      score,
      delta,
      band: scoreBand(score),
      percentile: Math.max(20, Math.min(98, Math.round(score * 10 + 4))),
      responseCount: 6 + Math.floor(seeded(pillarId + last.weekId) * 8),
    };
  });
}

/** Build a believable A/B/C response split that leans with the score. */
function mkResponses(score: number): QuestionInsight["responses"] {
  if (score >= 8.5) return [{ key: "A", text: "Definitely yes", pct: 70 }, { key: "B", text: "Mostly yes", pct: 22 }, { key: "C", text: "Sometimes", pct: 8 }];
  if (score >= 7)   return [{ key: "A", text: "Yes, often", pct: 50 }, { key: "B", text: "Sometimes", pct: 35 }, { key: "C", text: "Not really", pct: 15 }];
  if (score >= 5.5) return [{ key: "A", text: "Partially", pct: 30 }, { key: "B", text: "Sometimes", pct: 40 }, { key: "C", text: "Rarely", pct: 30 }];
  return [{ key: "A", text: "Not really", pct: 15 }, { key: "B", text: "Rarely", pct: 35 }, { key: "C", text: "No", pct: 50 }];
}

/**
 * An INDIVIDUAL picked exactly one answer, so their breakdown is 100% on the
 * option matching their score and 0% on the rest (a distribution across options
 * only makes sense for team aggregates, not one person).
 */
function singleAnswer(score: number): QuestionInsight["responses"] {
  const selected = score >= 7 ? "A" : score >= 4 ? "B" : "C";
  return mkResponses(score).map((o) => ({ ...o, pct: o.key === selected ? 100 : 0 }));
}

/** Sample question bank, three per pillar (replaced by real questions later). */
const SAMPLE_QUESTIONS: { id: string; text: string; pillarId: PillarId; base: number }[] = [
  { id: "q1",  pillarId: "meaningful_work", base: 9.0, text: "Do you get opportunities to tackle complex problems?" },
  { id: "q2",  pillarId: "meaningful_work", base: 8.4, text: "Does your work feel connected to a bigger purpose?" },
  { id: "q3",  pillarId: "meaningful_work", base: 7.8, text: "Does your role excite and challenge you?" },
  { id: "q4",  pillarId: "growth",          base: 8.0, text: "Are you learning new skills in your current role?" },
  { id: "q5",  pillarId: "growth",          base: 7.2, text: "Does your manager invest in your development?" },
  { id: "q6",  pillarId: "growth",          base: 6.4, text: "Do you have a clear path to grow in this company?" },
  { id: "q7",  pillarId: "culture",         base: 7.5, text: "Do you feel a sense of belonging on your team?" },
  { id: "q8",  pillarId: "culture",         base: 7.0, text: "Do you feel psychologically safe raising concerns?" },
  { id: "q9",  pillarId: "culture",         base: 6.6, text: "Do you feel recognised for good work?" },
  { id: "q10", pillarId: "compensation",    base: 5.8, text: "Do you feel fairly compensated for your work?" },
  { id: "q11", pillarId: "compensation",    base: 5.2, text: "Do you know how your pay compares to the market?" },
  { id: "q12", pillarId: "compensation",    base: 6.2, text: "Are your benefits competitive in the market?" },
];

function questionInsights(seedKey: string): QuestionInsight[] {
  return SAMPLE_QUESTIONS.map((q) => {
    const wobble = (seeded(seedKey + q.id) - 0.5) * 1.2;
    const score = Math.min(10, Math.max(1, round1(q.base + wobble)));
    return {
      id: q.id,
      text: q.text,
      pillarId: q.pillarId,
      score,
      responses: singleAnswer(score),
      recommendation: getSampleRecommendation(q.pillarId).text,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public data functions (every screen calls these)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An individual's own scores for a window. A user may only read their own
 * data — enforced by assertOwner. Managers cannot reach individual scores here.
 *
 * NOTE: the REAL D1 implementation now lives in lib/scores.ts (server-only) and
 * is what the app uses. This sample version is kept only for the throwaway
 * /kit-preview page, which renders components client-side without a real session.
 */
export async function getEmployeeScores(
  session: SessionUser,
  userId: string,
  window: Window = "3M"
): Promise<EmployeeScores> {
  assertOwner(session, userId);

  const points = Math.min(weeksIn(window), RECENT_WEEKS.length);
  const trend = buildTrend(userId, 7.1, points);
  const overall = trend[trend.length - 1].overall;
  const prior = trend.length > 1 ? trend[trend.length - 2].overall : null;

  return {
    enoughData: true,
    overall,
    delta: prior === null ? null : round1(overall - prior),
    percentile: 72,
    percentiles: { org: 91, dept: 88, industry: 78 },
    participation: 86,
    responseCount: points * 2,
    streak: 4,
    pillars: pillarScoresFrom(trend),
    questions: questionInsights(userId),
    trend,
  };
}

/** Detail for one pillar (used by the pillar-detail screen). Own data only. */
export async function getPillarDetail(
  session: SessionUser,
  userId: string,
  pillarId: PillarId,
  window: Window = "3M"
) {
  assertOwner(session, userId);
  const points = Math.min(weeksIn(window), RECENT_WEEKS.length);
  const trend = buildTrend(userId + pillarId, 6.8, points);
  const score = trend[trend.length - 1][pillarId];
  const prior = trend.length > 1 ? trend[trend.length - 2][pillarId] : null;

  return {
    pillarId,
    score,
    delta: prior === null ? null : round1(score - prior),
    percentile: Math.max(20, Math.min(98, Math.round(score * 10 + 4))),
    band: scoreBand(score),
    trend,
    questions: questionInsights(userId + pillarId).filter((q) => q.pillarId === pillarId),
  };
}

/**
 * NOTE: the REAL D1 implementation now lives in lib/team.ts (server-only) and is
 * what the app uses. This sample version is kept only for the /kit-preview page.
 *
 * Aggregated team view for a manager. Enforces the anonymisation floor:
 * nothing is returned unless there are >= ANONYMISATION_FLOOR reportees and
 * responses. Returns only aggregates — never an individual-identifying field.
 */
export async function getTeamAggregate(
  session: SessionUser,
  teamId: string,
  window: Window = "3M"
): Promise<TeamAggregate> {
  assertRole(session, "manager", "reviewing_manager", "ceo_hr");

  // Sample: this team has 6 reportees with responses above the floor.
  const reporteeCount = 6;
  const responseCount = 41;

  const empty: TeamAggregate = {
    enoughData: false,
    reason: `Need at least ${ANONYMISATION_FLOOR} reportees with responses to show team data.`,
    teamScore: null,
    delta: null,
    participation: 0,
    reporteeCount,
    pillars: [],
    trend: [],
  };

  if (reporteeCount < ANONYMISATION_FLOOR) return empty;
  if (enforceAnonymisationFloor(true, responseCount) === null) return empty;

  const points = Math.min(weeksIn(window), RECENT_WEEKS.length);
  const trend = buildTrend("team-" + teamId, 6.7, points);
  const teamScore = trend[trend.length - 1].overall;
  const prior = trend.length > 1 ? trend[trend.length - 2].overall : null;

  return {
    enoughData: true,
    teamScore,
    delta: prior === null ? null : round1(teamScore - prior),
    participation: 78,
    reporteeCount,
    pillars: pillarScoresFrom(trend),
    trend,
  };
}

/** A sample recommendation for a low-scoring pillar (RecommendationCard). */
export function getSampleRecommendation(pillarId: PillarId): { pillarId: PillarId; text: string } {
  const text: Record<PillarId, string> = {
    meaningful_work: "Try linking one task this week to a goal you personally care about, and note how it felt.",
    growth: "Ask your manager for one stretch task this sprint, something just beyond your current comfort zone.",
    culture: "Recognise a teammate's good work openly this week; small recognition compounds team trust.",
    compensation: "Document your recent wins so you have concrete examples ready for your next comp conversation.",
  };
  return { pillarId, text: text[pillarId] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Check-in flow (the weekly questions an employee answers)
// ─────────────────────────────────────────────────────────────────────────────

/** One tappable answer. Its `score` is hidden in the UI (per spec). */
export interface CheckInOption {
  key: "A" | "B" | "C";
  text: string;
  score: number;
}

/** A single check-in question with its A/B/C options. */
export interface CheckInQuestion {
  id: string;
  text: string;
  pillarId: PillarId;
  options: CheckInOption[];
  weekLabel?: string; // for catch-up questions, e.g. "Last week"
}

// NOTE: getDueCheckIns, getUnansweredCheckIns, submitCheckIn and getLatestCheckIn
// now have REAL D1 implementations in lib/checkins.ts (server-only). The types
// (CheckInQuestion, LatestCheckIn, …) stay here so client components can import
// them. skipCheckIn / getOpenRecommendation / submitFollowUp remain sample for now.

/**
 * Skip a question for now. Sample no-op; server-side, 3 consecutive skips of the
 * same question permanently retire it (real logic lands with D1).
 */
export async function skipCheckIn(
  session: SessionUser,
  userId: string,
  questionId: string,
): Promise<void> {
  assertOwner(session, userId);
  void questionId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Return check-in / follow-up (did you act on your last recommendation?)
// ─────────────────────────────────────────────────────────────────────────────

/** A past low-score recommendation the user hasn't told us they acted on yet. */
export interface OpenRecommendation {
  questionId: string;
  pillarId: PillarId;
  questionText: string;
  recommendation: string;
  weekLabel: string; // e.g. "Apr 2026"
}

/**
 * The single oldest unacted low-score recommendation for this user, or null if
 * there's nothing to follow up on. Own data only. Sample for now; the real D1
 * query finds the most recent checkIn with score<7 and followUpStatus IS NULL.
 */
export async function getOpenRecommendation(
  session: SessionUser,
  userId: string,
): Promise<OpenRecommendation | null> {
  assertOwner(session, userId);
  return {
    questionId: "q6",
    pillarId: "growth",
    questionText: "Do you have a clear path to grow in this company?",
    recommendation: getSampleRecommendation("growth").text,
    weekLabel: "Apr 2026",
  };
}

/**
 * Record the answer to a follow-up. "acted" also saves what they did as a
 * journal entry (private to the author). Sample no-op for now; the real D1 write
 * sets checkIns.followUpStatus and inserts a journalEntries row (type follow_up).
 */
export async function submitFollowUp(
  session: SessionUser,
  userId: string,
  input: { questionId: string; pillarId: PillarId; status: FollowUpStatus; journalText?: string },
): Promise<void> {
  assertOwner(session, userId);
  void input;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inbox (Phase 2.6): latest check-in summary · unanswered list (reuses the
// check-in functions above) · "Actions taken on your feedback" + history.
// ─────────────────────────────────────────────────────────────────────────────

/** A summary of the user's most recent answered check-in, for the Inbox. */
export interface LatestCheckIn {
  questionText: string;
  pillarId: PillarId;
  score: number;
  isLow: boolean; // score < 7
  recommendation: string | null; // present when low
  dateLabel: string; // e.g. "April 2026"
}

// getLatestCheckIn now has a real D1 implementation in lib/checkins.ts.

/** How the employee felt about a manager action they can see. */
export type ActionResponseValue = "yes" | "maybe" | "not_yet";

/**
 * A change a manager made in response to team feedback, surfaced to the employee.
 * PRIVACY: server-side, an action is returned to an employee ONLY if they scored
 * <7 on that question, ONLY after the 4-week delay (visibleToEmployeesAt), and
 * ONLY when the team has ≥3 responses. The sample list below is already filtered
 * to what this user may see; the real D1 query enforces the same rules.
 */
export interface FeedbackAction {
  id: string;
  pillarId: PillarId;
  pillarLabel: string;
  actionNote: string; // what the manager changed
  dateLabel: string; // e.g. "Visible since Jun 2026"
  response: ActionResponseValue | null; // this employee's response so far
}

export async function getFeedbackActions(
  session: SessionUser,
  userId: string,
): Promise<FeedbackAction[]> {
  assertOwner(session, userId);
  return [
    {
      id: "act-culture-1",
      pillarId: "culture",
      pillarLabel: PILLARS.culture.label,
      actionNote:
        "Added a fortnightly recognition moment to team standup, so good work gets noticed openly.",
      dateLabel: "Visible since Jun 2026",
      response: null,
    },
  ];
}

/**
 * Record how the employee felt about an action (+ an optional anonymous note for
 * "maybe"/"not_yet"). One response per employee per action; submitting moves the
 * item into history. Sample no-op for now; real D1 writes employeeResponses.
 */
export async function submitActionResponse(
  session: SessionUser,
  userId: string,
  input: { actionId: string; response: ActionResponseValue; note?: string },
): Promise<void> {
  assertOwner(session, userId);
  void input;
}

/** A past action the employee has already responded to (read-only history, 2.6b). */
export interface ActionHistoryItem {
  id: string;
  pillarLabel: string;
  actionNote: string;
  response: ActionResponseValue;
  note: string | null; // the anonymous note they sent, if any
  respondedAtLabel: string;
}

export async function getActionHistory(
  session: SessionUser,
  userId: string,
): Promise<ActionHistoryItem[]> {
  assertOwner(session, userId);
  return [
    {
      id: "act-growth-0",
      pillarLabel: PILLARS.growth.label,
      actionNote: "Set up monthly career-path 1:1s to make progression clearer.",
      response: "yes",
      note: null,
      respondedAtLabel: "May 2026",
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile (Phase 2.7): header stats, streak, badges, career-tenure summary.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfileStats {
  role: string;
  company: string;
  overallScore: number;
  delta: number;
  streak: number;
  longestStreak: number;
  totalCheckIns: number;
  participationPct: number;
  recentWeeks: boolean[]; // most recent ~10 weeks; true = checked in (dot row, not a heatmap)
  badges: string[]; // earned badge labels
  careerTenure: string; // total across companies, e.g. "5 yrs 1 mo"
}

/** Header + activity summary for the profile. Own data only.
 *  NOTE: superseded by the real D1 implementation in lib/profile.ts (server-only),
 *  which the app now uses. This sample copy is unused and can be removed later. */
export async function getProfileStats(
  session: SessionUser,
  userId: string,
): Promise<ProfileStats> {
  assertOwner(session, userId);
  return {
    role: "Product Designer",
    company: "Kissflow",
    overallScore: 7.2,
    delta: 0.4,
    streak: 4,
    longestStreak: 12,
    totalCheckIns: 34,
    participationPct: 82,
    recentWeeks: [true, true, false, true, true, true, false, true, true, true],
    badges: ["Growth Explorer", "Culture Champion", "Reflective Thinker"],
    careerTenure: "5 yrs 1 mo",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Career history (Phase 2.8 + company detail 2.8b). Past-company data is a
// static, self-reported snapshot (frozen); the current company links to live data.
// ─────────────────────────────────────────────────────────────────────────────

export interface CareerCompanySummary {
  id: string;
  company: string;
  role: string;
  period: string;
  tenure: string;
  overallScore: number;
  current: boolean;
}

export interface CareerHistory {
  overall: number; // overall career happiness across companies
  tenure: string; // total tenure across all companies
  companies: CareerCompanySummary[];
}

const CAREER: CareerCompanySummary[] = [
  { id: "kissflow", company: "Kissflow", role: "Product Designer", period: "Jan 2024 – Present", tenure: "2 yrs 3 mos", overallScore: 7.2, current: true },
  { id: "google", company: "Google", role: "UX Researcher", period: "Jun 2022 – Dec 2023", tenure: "1 yr 6 mos", overallScore: 8.5, current: false },
  { id: "razorpay", company: "Razorpay", role: "UI Designer", period: "Aug 2021 – May 2022", tenure: "9 mos", overallScore: 6.2, current: false },
];

export async function getCareerHistory(session: SessionUser, userId: string): Promise<CareerHistory> {
  assertOwner(session, userId);
  return { overall: 7.4, tenure: "4 yrs 6 mos", companies: CAREER };
}

export interface CompanyPillarScore {
  pillarId: PillarId;
  label: string;
  score: number;
}

export interface CompanyQuestionScore {
  text: string;
  score: number;
}

export interface CompanyDetail {
  id: string;
  company: string;
  role: string;
  period: string;
  current: boolean;
  overallScore: number;
  frozenAt: string;
  participationPct: number;
  pillars: CompanyPillarScore[];
  strengths: CompanyQuestionScore[];
  concerns: CompanyQuestionScore[];
}

const pillarRow = (id: PillarId, score: number): CompanyPillarScore => ({ pillarId: id, label: PILLARS[id].label, score });

const COMPANY_DETAILS: Record<string, CompanyDetail> = {
  kissflow: {
    id: "kissflow", company: "Kissflow", role: "Product Designer", period: "Jan 2024 – Present", current: true,
    overallScore: 7.2, frozenAt: "Live data", participationPct: 91,
    pillars: [pillarRow("meaningful_work", 8.4), pillarRow("growth", 6.9), pillarRow("culture", 7.5), pillarRow("compensation", 6.8)],
    strengths: [
      { text: "Do you get opportunities to tackle complex problems?", score: 9.0 },
      { text: "Does your work have a clear purpose?", score: 8.4 },
      { text: "Does your team celebrate wins together?", score: 7.6 },
    ],
    concerns: [
      { text: "Do you know how your pay compares to the market?", score: 5.8 },
      { text: "Do you have a clear path to grow here?", score: 6.2 },
      { text: "Do you feel recognised for good work?", score: 6.6 },
    ],
  },
  google: {
    id: "google", company: "Google", role: "UX Researcher", period: "Jun 2022 – Dec 2023", current: false,
    overallScore: 8.5, frozenAt: "Dec 2023", participationPct: 94,
    pillars: [pillarRow("meaningful_work", 9.1), pillarRow("growth", 8.9), pillarRow("culture", 8.3), pillarRow("compensation", 8.0)],
    strengths: [
      { text: "Do you feel a strong sense of belonging on your team?", score: 9.2 },
      { text: "Does your manager support your development?", score: 9.0 },
      { text: "Do you feel fairly compensated for your work?", score: 8.8 },
    ],
    concerns: [
      { text: "Do you maintain a healthy work-life balance?", score: 6.0 },
      { text: "Do you feel your workload is manageable?", score: 6.2 },
    ],
  },
  razorpay: {
    id: "razorpay", company: "Razorpay", role: "UI Designer", period: "Aug 2021 – May 2022", current: false,
    overallScore: 6.2, frozenAt: "May 2022", participationPct: 78,
    pillars: [pillarRow("meaningful_work", 6.5), pillarRow("growth", 6.3), pillarRow("culture", 5.8), pillarRow("compensation", 5.4)],
    strengths: [
      { text: "Are you learning new skills in your role?", score: 7.8 },
      { text: "Does your role expose you to new challenges?", score: 7.2 },
    ],
    concerns: [
      { text: "Do you feel heard in group discussions?", score: 5.0 },
      { text: "Does your team communicate openly?", score: 5.2 },
      { text: "Do you feel fairly compensated?", score: 5.5 },
    ],
  },
};

export async function getCompanyDetail(
  session: SessionUser,
  userId: string,
  companyId: string,
): Promise<CompanyDetail | null> {
  assertOwner(session, userId);
  return COMPANY_DETAILS[companyId] ?? null;
}

/** Re-export so screens can build ScoreResult-shaped deltas without a second import. */
export { trendDelta, type ScoreResult };

// ─────────────────────────────────────────────────────────────────────────────
// Wisdom (Phase 2.9): the learning path. Three levels (Beginner / Advanced /
// Expert); each level holds one module per pillar, ordered LOWEST-PILLAR FIRST
// so the weakest area is surfaced first. Each module has content items
// (article / video = partial progress; quiz = completes the module + awards its
// badge). When every module badge in a level is earned, the next level unlocks.
//
// Screen-local types (distinct from the DB-shaped WisdomModule in types.ts).
// Sample data for now; the shapes won't change when this is wired to D1.
// ─────────────────────────────────────────────────────────────────────────────

export type WisdomItemType = "article" | "video" | "quiz";

export interface WisdomItemView {
  id: string;
  title: string;
  type: WisdomItemType;
  duration: string;
  desc: string;
  done: boolean;
}

export interface WisdomModuleView {
  id: string;
  pillarId: PillarId;
  pillarLabel: string;
  title: string;
  badge: string; // badge name awarded when the quiz is completed
  badgeEarned: boolean;
  items: WisdomItemView[];
}

export interface WisdomLevelView {
  level: WisdomLevel;
  name: string;
  subtitle: string;
  icon: string;
  unlocked: boolean;
  modules: WisdomModuleView[]; // ordered lowest-pillar first
}

export interface WisdomBadge {
  label: string;
  icon: string;
  earned: boolean;
}

export interface WisdomData {
  currentLevel: WisdomLevel;
  levels: WisdomLevelView[];
  badges: WisdomBadge[];
  /** Pillar order driving module ordering (ascending score = weakest first). */
  pillarOrder: PillarId[];
  totalItems: number;
  doneItems: number;
}

const LEVEL_META: Record<WisdomLevel, { name: string; subtitle: string; icon: string }> = {
  beginner: { name: "Beginner", subtitle: "Know yourself", icon: "🌱" },
  advanced: { name: "Advanced", subtitle: "Build habits", icon: "⚡" },
  expert:   { name: "Expert",   subtitle: "Lead your growth", icon: "🏆" },
};

// Per-pillar copy for each level's module (title + the three content items).
const MODULE_COPY: Record<WisdomLevel, Record<PillarId, { title: string; badge: string; items: Omit<WisdomItemView, "done">[] }>> = {
  beginner: {
    meaningful_work: {
      title: "Find your why",
      badge: "Purpose Seeker",
      items: [
        { id: "b-mw-1", title: "What meaningful work really means", type: "video",   duration: "5 min", desc: "Reframe how you think about purpose at work." },
        { id: "b-mw-2", title: "Map your strengths to outcomes",     type: "article", duration: "3 min", desc: "Connect what you're good at to what matters." },
        { id: "b-mw-3", title: "Meaningful work quiz",               type: "quiz",    duration: "2 min", desc: "Lock in the basics and earn your badge." },
      ],
    },
    growth: {
      title: "Growth mindset basics",
      badge: "Growth Explorer",
      items: [
        { id: "b-gr-1", title: "The science of a growth mindset", type: "article", duration: "5 min", desc: "Why effort beats fixed talent over time." },
        { id: "b-gr-2", title: "Spotting your learning edges",    type: "video",   duration: "4 min", desc: "Find the skills that will move you forward." },
        { id: "b-gr-3", title: "Growth quiz",                     type: "quiz",    duration: "2 min", desc: "Check your understanding and earn the badge." },
      ],
    },
    culture: {
      title: "Belonging at work",
      badge: "Culture Champion",
      items: [
        { id: "b-cu-1", title: "Why belonging drives performance", type: "article", duration: "6 min", desc: "Psychological safety, explained simply." },
        { id: "b-cu-2", title: "Small ways to build trust",        type: "video",   duration: "4 min", desc: "Everyday habits that strengthen a team." },
        { id: "b-cu-3", title: "Culture quiz",                     type: "quiz",    duration: "2 min", desc: "Test the ideas and earn the badge." },
      ],
    },
    compensation: {
      title: "Know your worth",
      badge: "Value Aware",
      items: [
        { id: "b-co-1", title: "How to research your market value", type: "article", duration: "4 min", desc: "Where to look and what to compare." },
        { id: "b-co-2", title: "Talking about pay with confidence", type: "video",   duration: "6 min", desc: "Frame the conversation around value." },
        { id: "b-co-3", title: "Compensation quiz",                 type: "quiz",    duration: "2 min", desc: "Confirm the essentials and earn the badge." },
      ],
    },
  },
  advanced: {
    meaningful_work: {
      title: "Design work you love",
      badge: "Craft Builder",
      items: [
        { id: "a-mw-1", title: "Job crafting in practice",  type: "article", duration: "7 min", desc: "Reshape your role around your strengths." },
        { id: "a-mw-2", title: "Negotiating for better work", type: "video", duration: "6 min", desc: "Ask for the projects that energise you." },
        { id: "a-mw-3", title: "Job crafting quiz",         type: "quiz",    duration: "3 min", desc: "Apply the framework and earn the badge." },
      ],
    },
    growth: {
      title: "Habits that stick",
      badge: "Habit Architect",
      items: [
        { id: "a-gr-1", title: "Build a growth habit that lasts", type: "article", duration: "5 min", desc: "Science-backed routines for real change." },
        { id: "a-gr-2", title: "Feedback loops that compound",    type: "video",   duration: "8 min", desc: "Turn feedback into steady momentum." },
        { id: "a-gr-3", title: "Habits quiz",                     type: "quiz",    duration: "3 min", desc: "Lock in the method and earn the badge." },
      ],
    },
    culture: {
      title: "Strengthen your team",
      badge: "Team Builder",
      items: [
        { id: "a-cu-1", title: "Repairing trust after friction", type: "article", duration: "6 min", desc: "How healthy teams recover and grow." },
        { id: "a-cu-2", title: "Running better conversations",   type: "video",   duration: "7 min", desc: "Make every 1:1 and stand-up count." },
        { id: "a-cu-3", title: "Team quiz",                      type: "quiz",    duration: "3 min", desc: "Apply the ideas and earn the badge." },
      ],
    },
    compensation: {
      title: "Negotiate well",
      badge: "Deal Maker",
      items: [
        { id: "a-co-1", title: "Preparing for a pay conversation", type: "article", duration: "6 min", desc: "Build the case before you sit down." },
        { id: "a-co-2", title: "Handling the negotiation",         type: "video",   duration: "9 min", desc: "Stay calm, anchored, and collaborative." },
        { id: "a-co-3", title: "Negotiation quiz",                 type: "quiz",    duration: "3 min", desc: "Rehearse the moves and earn the badge." },
      ],
    },
  },
  expert: {
    meaningful_work: {
      title: "Lead with purpose",
      badge: "Purpose Leader",
      items: [
        { id: "e-mw-1", title: "Helping others find meaning", type: "article", duration: "8 min", desc: "Connect a team's work to a larger why." },
        { id: "e-mw-2", title: "Lead without a title",        type: "video",   duration: "12 min", desc: "Drive culture and momentum from any seat." },
        { id: "e-mw-3", title: "Purpose quiz",               type: "quiz",    duration: "3 min", desc: "Cement the practice and earn the badge." },
      ],
    },
    growth: {
      title: "Coach growth",
      badge: "Growth Coach",
      items: [
        { id: "e-gr-1", title: "Design a 5-year career arc", type: "article", duration: "8 min", desc: "Craft a vision that guides your decisions." },
        { id: "e-gr-2", title: "Coaching others to grow",    type: "video",   duration: "10 min", desc: "Ask the questions that unlock progress." },
        { id: "e-gr-3", title: "Coaching quiz",              type: "quiz",    duration: "3 min", desc: "Practise the approach and earn the badge." },
      ],
    },
    culture: {
      title: "Shape culture",
      badge: "Culture Architect",
      items: [
        { id: "e-cu-1", title: "Designing team rituals",    type: "article", duration: "7 min", desc: "Make values visible in daily habits." },
        { id: "e-cu-2", title: "Leading through ambiguity", type: "video",   duration: "11 min", desc: "Keep a team steady when things are unclear." },
        { id: "e-cu-3", title: "Culture quiz",              type: "quiz",    duration: "3 min", desc: "Apply the playbook and earn the badge." },
      ],
    },
    compensation: {
      title: "Own your trajectory",
      badge: "Trajectory Owner",
      items: [
        { id: "e-co-1", title: "Building long-term wealth from work", type: "article", duration: "9 min", desc: "Think beyond the next pay rise." },
        { id: "e-co-2", title: "Advocating for your team's pay",      type: "video",   duration: "8 min", desc: "Make the case for fair reward." },
        { id: "e-co-3", title: "Trajectory quiz",                    type: "quiz",    duration: "3 min", desc: "Finish strong and earn the badge." },
      ],
    },
  },
};

// Manager (leadership) audience copy — same structure and item ids as the
// employee set, but framed around leading a team on each pillar. Phase 3.4.
// Placeholder content; real videos/articles arrive via the admin CMS later.
const MODULE_COPY_MANAGER: Record<WisdomLevel, Record<PillarId, { title: string; badge: string; items: Omit<WisdomItemView, "done">[] }>> = {
  beginner: {
    meaningful_work: {
      title: "Connect work to why",
      badge: "Purpose Guide",
      items: [
        { id: "b-mw-1", title: "Help your team see the bigger picture", type: "video",   duration: "5 min", desc: "Tie everyday tasks to a purpose people feel." },
        { id: "b-mw-2", title: "Link each role to real outcomes",       type: "article", duration: "3 min", desc: "Show people how their work moves the needle." },
        { id: "b-mw-3", title: "Purpose-leadership quiz",               type: "quiz",    duration: "2 min", desc: "Lock in the basics and earn your badge." },
      ],
    },
    growth: {
      title: "Grow your people",
      badge: "Growth Enabler",
      items: [
        { id: "b-gr-1", title: "Why development drives retention",   type: "article", duration: "5 min", desc: "Growth is the strongest reason people stay." },
        { id: "b-gr-2", title: "Spot growth potential on your team", type: "video",   duration: "4 min", desc: "Notice the signals that someone is ready for more." },
        { id: "b-gr-3", title: "Growth-leadership quiz",             type: "quiz",    duration: "2 min", desc: "Check your understanding and earn the badge." },
      ],
    },
    culture: {
      title: "Build psychological safety",
      badge: "Safety Builder",
      items: [
        { id: "b-cu-1", title: "What makes a team feel safe", type: "article", duration: "6 min", desc: "The foundation every high-trust team shares." },
        { id: "b-cu-2", title: "Everyday habits that build trust", type: "video", duration: "4 min", desc: "Small leader behaviours with outsized impact." },
        { id: "b-cu-3", title: "Culture-leadership quiz",     type: "quiz",    duration: "2 min", desc: "Test the ideas and earn the badge." },
      ],
    },
    compensation: {
      title: "Fairness & transparency",
      badge: "Fair Pay Ally",
      items: [
        { id: "b-co-1", title: "Talking about pay fairly", type: "article", duration: "4 min", desc: "Handle a sensitive topic with openness." },
        { id: "b-co-2", title: "Answering pay questions with confidence", type: "video", duration: "6 min", desc: "What to say — and what not to promise." },
        { id: "b-co-3", title: "Pay-leadership quiz",      type: "quiz",    duration: "2 min", desc: "Confirm the essentials and earn the badge." },
      ],
    },
  },
  advanced: {
    meaningful_work: {
      title: "Design meaningful roles",
      badge: "Role Designer",
      items: [
        { id: "a-mw-1", title: "Job crafting with your team",   type: "article", duration: "7 min", desc: "Reshape roles around people's strengths." },
        { id: "a-mw-2", title: "Assign work that energises",     type: "video",   duration: "6 min", desc: "Match the right work to the right person." },
        { id: "a-mw-3", title: "Role-design quiz",               type: "quiz",    duration: "3 min", desc: "Apply the framework and earn the badge." },
      ],
    },
    growth: {
      title: "Coach in your 1:1s",
      badge: "Coaching Lead",
      items: [
        { id: "a-gr-1", title: "Make 1:1s about growth", type: "article", duration: "5 min", desc: "Turn status updates into development." },
        { id: "a-gr-2", title: "Feedback that compounds", type: "video",  duration: "8 min", desc: "Give feedback people can act on." },
        { id: "a-gr-3", title: "Coaching quiz",          type: "quiz",    duration: "3 min", desc: "Lock in the method and earn the badge." },
      ],
    },
    culture: {
      title: "Strengthen the team",
      badge: "Team Strengthener",
      items: [
        { id: "a-cu-1", title: "Repairing trust after friction", type: "article", duration: "6 min", desc: "How strong teams recover and grow." },
        { id: "a-cu-2", title: "Running better team conversations", type: "video", duration: "7 min", desc: "Make every stand-up and retro count." },
        { id: "a-cu-3", title: "Team quiz",                      type: "quiz",    duration: "3 min", desc: "Apply the ideas and earn the badge." },
      ],
    },
    compensation: {
      title: "Advocate for your team",
      badge: "Pay Advocate",
      items: [
        { id: "a-co-1", title: "Build the case for a raise",      type: "article", duration: "6 min", desc: "Make a clear, evidence-based argument." },
        { id: "a-co-2", title: "Navigating comp up the chain",    type: "video",   duration: "9 min", desc: "Champion fair pay with senior leaders." },
        { id: "a-co-3", title: "Advocacy quiz",                   type: "quiz",    duration: "3 min", desc: "Rehearse the moves and earn the badge." },
      ],
    },
  },
  expert: {
    meaningful_work: {
      title: "Lead with purpose",
      badge: "Purpose Leader",
      items: [
        { id: "e-mw-1", title: "Build a purpose-driven team", type: "article", duration: "8 min", desc: "Connect a team's work to a larger why." },
        { id: "e-mw-2", title: "Lead change with meaning",    type: "video",   duration: "12 min", desc: "Keep purpose alive through hard transitions." },
        { id: "e-mw-3", title: "Purpose quiz",               type: "quiz",    duration: "3 min", desc: "Cement the practice and earn the badge." },
      ],
    },
    growth: {
      title: "Build a growth culture",
      badge: "Growth Architect",
      items: [
        { id: "e-gr-1", title: "Career arcs across a team", type: "article", duration: "8 min", desc: "Plan development beyond the next role." },
        { id: "e-gr-2", title: "Coach managers to coach",   type: "video",   duration: "10 min", desc: "Scale good coaching through your leaders." },
        { id: "e-gr-3", title: "Growth-culture quiz",       type: "quiz",    duration: "3 min", desc: "Practise the approach and earn the badge." },
      ],
    },
    culture: {
      title: "Architect the culture",
      badge: "Culture Architect",
      items: [
        { id: "e-cu-1", title: "Designing team rituals",    type: "article", duration: "7 min", desc: "Make values visible in daily habits." },
        { id: "e-cu-2", title: "Leading through ambiguity", type: "video",   duration: "11 min", desc: "Keep a team steady when things are unclear." },
        { id: "e-cu-3", title: "Culture quiz",              type: "quiz",    duration: "3 min", desc: "Apply the playbook and earn the badge." },
      ],
    },
    compensation: {
      title: "Own team fairness",
      badge: "Equity Champion",
      items: [
        { id: "e-co-1", title: "Embedding pay equity",          type: "article", duration: "9 min", desc: "Make fairness a system, not a one-off." },
        { id: "e-co-2", title: "Advocating fair reward at scale", type: "video", duration: "8 min", desc: "Drive equitable pay across the org." },
        { id: "e-co-3", title: "Equity quiz",                   type: "quiz",    duration: "3 min", desc: "Finish strong and earn the badge." },
      ],
    },
  },
};

const BADGE_ICONS: Record<string, string> = {
  "Purpose Seeker": "🎯", "Growth Explorer": "🌿", "Culture Champion": "🤝", "Value Aware": "💰",
  "Craft Builder": "🛠️", "Habit Architect": "🧱", "Team Builder": "👥", "Deal Maker": "🤝",
  "Purpose Leader": "🧭", "Growth Coach": "📈", "Culture Architect": "🏛️", "Trajectory Owner": "🚀",
  // Manager (leadership) badges
  "Purpose Guide": "🧭", "Growth Enabler": "🌿", "Safety Builder": "🛡️", "Fair Pay Ally": "⚖️",
  "Role Designer": "🧩", "Coaching Lead": "🎧", "Team Strengthener": "🤝", "Pay Advocate": "📣",
  "Growth Architect": "📈", "Equity Champion": "⚖️",
};

export type WisdomAudience = "employee" | "manager";

/**
 * The learning path for one user. Modules within each level are ordered by the
 * user's weakest pillar first. Sample progress: a couple of beginner items done.
 * Own data only.
 */
export async function getWisdom(
  session: SessionUser,
  userId: string,
  audience: WisdomAudience = "employee",
): Promise<WisdomData> {
  assertOwner(session, userId);

  // Employee path orders by the user's own weakest pillar; the manager
  // (leadership) path orders by the team's weakest pillar. Sample scores.
  const pillarScores: Record<PillarId, number> =
    audience === "manager"
      ? { growth: 5.9, culture: 6.5, compensation: 6.8, meaningful_work: 7.4 }
      : { compensation: 5.8, growth: 6.4, meaningful_work: 7.2, culture: 7.6 };
  const copyTable = audience === "manager" ? MODULE_COPY_MANAGER : MODULE_COPY;
  const pillarOrder = [...PILLAR_ORDER].sort((a, b) => pillarScores[a] - pillarScores[b]);

  // Sample completion: in Beginner the weakest pillar's module is fully done
  // (badge earned), the next has its article read (partial); rest untouched.
  const doneIds = new Set<string>([
    `b-${shortPillar(pillarOrder[0])}-1`,
    `b-${shortPillar(pillarOrder[0])}-2`,
    `b-${shortPillar(pillarOrder[0])}-3`,
    `b-${shortPillar(pillarOrder[1])}-1`,
  ]);

  const levelKeys: WisdomLevel[] = ["beginner", "advanced", "expert"];
  const levels: WisdomLevelView[] = [];
  let prevLevelComplete = true; // beginner is always unlocked

  for (const level of levelKeys) {
    const unlocked = prevLevelComplete;
    const modules: WisdomModuleView[] = pillarOrder.map((pillarId) => {
      const copy = copyTable[level][pillarId];
      const items = copy.items.map((it) => ({ ...it, done: doneIds.has(it.id) }));
      const quiz = items.find((i) => i.type === "quiz");
      return {
        id: `${level}-${shortPillar(pillarId)}`,
        pillarId,
        pillarLabel: PILLARS[pillarId].label,
        title: copy.title,
        badge: copy.badge,
        badgeEarned: !!quiz?.done,
        items,
      };
    });
    levels.push({ level, ...LEVEL_META[level], unlocked, modules });
    prevLevelComplete = modules.every((m) => m.badgeEarned);
  }

  const currentLevel = [...levels].reverse().find((l) => l.unlocked)?.level ?? "beginner";

  // Badges: one per module across all levels, earned flag from progress.
  const badges: WisdomBadge[] = levels.flatMap((l) =>
    l.modules.map((m) => ({
      label: m.badge,
      icon: BADGE_ICONS[m.badge] ?? "🏅",
      earned: m.badgeEarned,
    })),
  );

  const allItems = levels.flatMap((l) => l.modules.flatMap((m) => m.items));
  return {
    currentLevel,
    levels,
    badges,
    pillarOrder,
    totalItems: allItems.length,
    doneItems: allItems.filter((i) => i.done).length,
  };
}

/** Short pillar slug used in sample wisdom item ids (b-mw-1 etc.). */
function shortPillar(p: PillarId): string {
  return { meaningful_work: "mw", growth: "gr", culture: "cu", compensation: "co" }[p];
}

// ─────────────────────────────────────────────────────────────────────────────
// Manager Action Inbox (Phase 3.3): the 4-week feedback loop. Each flagged
// pillar/question becomes one action item (ONE action per question per cycle).
// The manager decides Yes (I'll act) or Not Yet; submitting an action logs it
// with submittedAt + visibleToEmployeesAt = +4 weeks, so it stays hidden from
// employees until then and is shown only to those who scored <7.
//
// Manager handover: when a manager changes, already-submitted actions stay and
// become visible on schedule; the new manager does NOT inherit open items, but
// CAN see prior open items + actions taken as a read-only report (`carriedOver`)
// so context isn't lost across transitions — for both manager and employees.
//
// PRIVACY: aggregates only, and the whole inbox is hidden below the
// anonymisation floor (<3 reportees). Enforced in server code here.
// ─────────────────────────────────────────────────────────────────────────────

export type ManagerActionDecision = "yes" | "not_yet";
export type ManagerActionStatus = "open" | "resolved" | "flagged";

export interface ManagerActionItem {
  id: string;
  pillarId: PillarId;
  pillarLabel: string;
  triggerQuestion: string;
  teamAvg: number; // aggregate score on the trigger question
  responses: { key: "A" | "B" | "C"; text: string; pct: number }[]; // A/B/C bar
  recommendation: string;
  status: ManagerActionStatus;
  dateLabel: string; // when it was flagged, e.g. "Flagged Jun 2026"
  // Present once the manager has acted on it:
  actionNote?: string;
  submittedAtLabel?: string;
  visibleToEmployeesLabel?: string;
  employeeResponse?: { yes: number; maybe: number; notYet: number }; // arrives via polling
  // Read-only handover context from a previous manager:
  carriedOver?: boolean;
  handledByLabel?: string; // e.g. "Logged by the previous manager"
}

export interface ManagerInbox {
  reporteeCount: number;
  enoughReportees: boolean; // >= ANONYMISATION_FLOOR
  resolvedPct: number; // resolved / (open + resolved)
  open: ManagerActionItem[];
  resolved: ManagerActionItem[];
}

/**
 * The manager's Action Inbox for their team. Returns aggregates only and is
 * empty (enoughReportees = false) below the anonymisation floor, in which case
 * the screen hides the inbox entirely.
 */
export async function getManagerInbox(
  session: SessionUser,
  teamId: string,
): Promise<ManagerInbox> {
  assertRole(session, "manager", "reviewing_manager", "ceo_hr");

  const reporteeCount = 6; // sample team size
  if (reporteeCount < ANONYMISATION_FLOOR) {
    return { reporteeCount, enoughReportees: false, resolvedPct: 0, open: [], resolved: [] };
  }

  const trend = buildTrend("team-" + teamId, 6.7, 8);
  const pillars = pillarScoresFrom(trend);
  const scoreFor = (pid: PillarId) => pillars.find((p) => p.pillarId === pid)?.score ?? 6;

  const triggers: Record<PillarId, string> = {
    meaningful_work: "Do you get to work on problems that matter to you?",
    growth: "Does your manager invest in your development?",
    culture: "Do you feel recognised for your good work?",
    compensation: "Do you feel fairly rewarded for your contribution?",
  };

  // One OPEN item per sub-7 pillar, weakest first (one action per question/cycle).
  const open: ManagerActionItem[] = PILLAR_ORDER.filter((pid) => scoreFor(pid) < 7)
    .sort((a, b) => scoreFor(a) - scoreFor(b))
    .map((pid) => {
      const teamAvg = round1(scoreFor(pid));
      return {
        id: `open-${pid}`,
        pillarId: pid,
        pillarLabel: PILLARS[pid].label,
        triggerQuestion: triggers[pid],
        teamAvg,
        responses: mkResponses(teamAvg),
        recommendation: getSampleRecommendation(pid).text,
        status: "open" as ManagerActionStatus,
        dateLabel: "Flagged Jun 2026",
      };
    });

  // RESOLVED — actions already submitted. Includes one carried over from the
  // previous manager (read-only report) so transition context isn't lost.
  const resolved: ManagerActionItem[] = [
    {
      id: "res-growth",
      pillarId: "growth",
      pillarLabel: PILLARS.growth.label,
      triggerQuestion: triggers.growth,
      teamAvg: 6.3,
      responses: mkResponses(6.3),
      recommendation: getSampleRecommendation("growth").text,
      status: "resolved",
      dateLabel: "Flagged Apr 2026",
      actionNote: "Set up monthly career-path 1:1s so progression is clearer for everyone.",
      submittedAtLabel: "Submitted May 2026",
      visibleToEmployeesLabel: "Visible to team since Jun 2026",
      employeeResponse: { yes: 4, maybe: 1, notYet: 0 },
    },
    {
      id: "res-culture",
      pillarId: "culture",
      pillarLabel: PILLARS.culture.label,
      triggerQuestion: triggers.culture,
      teamAvg: 6.8,
      responses: mkResponses(6.8),
      recommendation: getSampleRecommendation("culture").text,
      status: "resolved",
      dateLabel: "Flagged Feb 2026",
      actionNote: "Added a fortnightly recognition moment to standup so good work gets noticed openly.",
      submittedAtLabel: "Submitted Mar 2026",
      visibleToEmployeesLabel: "Visible to team since Apr 2026",
      employeeResponse: { yes: 3, maybe: 2, notYet: 1 },
      carriedOver: true,
      handledByLabel: "Logged by the previous manager",
    },
  ];

  const total = open.length + resolved.length;
  const resolvedPct = total === 0 ? 0 : Math.round((resolved.length / total) * 100);

  return { reporteeCount, enoughReportees: true, resolvedPct, open, resolved };
}

/**
 * Log a manager's decision on an action item. "yes" records the action with a
 * journal note and sets visibleToEmployeesAt = submittedAt + 4 weeks; "not_yet"
 * flags it for revisiting. One action per question per cycle (no double-log).
 * Sample no-op for now; real D1 writes managerActions + a journalEntries row.
 */
export async function submitManagerAction(
  session: SessionUser,
  input: { itemId: string; decision: ManagerActionDecision; note?: string },
): Promise<void> {
  assertRole(session, "manager", "reviewing_manager", "ceo_hr");
  void input;
}

/** Weeks of delay before a submitted manager action becomes visible to employees. */
export const MANAGER_ACTION_DELAY_WEEKS = 4;

// ─────────────────────────────────────────────────────────────────────────────
// Reviewing Manager (Phase 4.1 / 4.2): a senior leader reviews the managers who
// report to them. Strictly aggregates — team scores, never an individual. There
// is deliberately NO participation rate next to a manager's name. A manager's
// team below the anonymisation floor shows no score at all.
// ─────────────────────────────────────────────────────────────────────────────

/** One reportee-manager's roll-up for the list (4.1). */
export interface ManagerSummary {
  managerId: string;
  name: string;
  teamScore: number | null; // null when the team is below the floor
  delta: number | null;
  percentile: number | null;
  resolutionPct: number | null; // % of feedback actions resolved
  band: "green" | "amber" | "red" | null;
  enoughData: boolean;
}

export interface ReviewingManagerList {
  orgAvg: number | null;
  managerCount: number; // how many managers report to this reviewer
  shownCount: number; // how many are above the floor (have a score)
  managers: ManagerSummary[]; // ranked: scored first, highest score first
}

/** A single manager's team detail for the drill-in (4.2). */
export interface ManagerDetail {
  managerId: string;
  name: string;
  enoughData: boolean;
  reason?: string;
  teamScore: number | null;
  delta: number | null;
  percentile: number | null;
  resolutionPct: number | null;
  pillars: PillarScore[];
  trend: TrendPoint[];
}

/** Sample managers reporting to the reviewer. One sits below the floor on purpose. */
const SAMPLE_MANAGERS: { id: string; name: string; base: number; reporteeCount: number }[] = [
  { id: "m-aria",  name: "Aria Sharma", base: 7.9, reporteeCount: 7 },
  { id: "m-leo",   name: "Leo Martins", base: 7.1, reporteeCount: 6 },
  { id: "m-priya", name: "Priya Nair",  base: 6.5, reporteeCount: 5 },
  { id: "m-tom",   name: "Tom Becker",  base: 5.8, reporteeCount: 9 },
  { id: "m-mei",   name: "Mei Tan",     base: 6.4, reporteeCount: 2 }, // below floor → hidden score
];

function pctFromScore(score: number): number {
  return Math.max(20, Math.min(98, Math.round(score * 10 + 4)));
}

function resolutionFor(id: string): number {
  return 45 + Math.round(seeded("res-" + id) * 50); // 45–95%
}

// NOTE: getReviewingManagerList / getReviewingManagerDetail are superseded by the
// real D1 implementations in lib/reviewing.ts (server-only), which the app uses.
// These sample copies are unused and can be removed later.
export async function getReviewingManagerList(
  session: SessionUser,
  window: Window = "3M",
): Promise<ReviewingManagerList> {
  assertRole(session, "reviewing_manager", "ceo_hr");

  const points = Math.min(weeksIn(window), RECENT_WEEKS.length);
  const managers: ManagerSummary[] = SAMPLE_MANAGERS.map((m) => {
    // Below the anonymisation floor → no score reaches the reviewer at all.
    if (m.reporteeCount < ANONYMISATION_FLOOR) {
      return {
        managerId: m.id,
        name: m.name,
        teamScore: null,
        delta: null,
        percentile: null,
        resolutionPct: null,
        band: null,
        enoughData: false,
      };
    }
    const trend = buildTrend("team-" + m.id, m.base, points);
    const teamScore = trend[trend.length - 1].overall;
    const prior = trend.length > 1 ? trend[trend.length - 2].overall : null;
    return {
      managerId: m.id,
      name: m.name,
      teamScore,
      delta: prior === null ? null : round1(teamScore - prior),
      percentile: pctFromScore(teamScore),
      resolutionPct: resolutionFor(m.id),
      band: scoreBand(teamScore),
      enoughData: true,
    };
  });

  const shown = managers.filter((m) => m.enoughData && m.teamScore !== null);
  const orgAvg = shown.length
    ? round1(shown.reduce((s, m) => s + (m.teamScore ?? 0), 0) / shown.length)
    : null;

  // Rank: managers with a score first, highest score first.
  managers.sort(
    (a, b) => Number(b.enoughData) - Number(a.enoughData) || (b.teamScore ?? 0) - (a.teamScore ?? 0),
  );

  return { orgAvg, managerCount: managers.length, shownCount: shown.length, managers };
}

export async function getReviewingManagerDetail(
  session: SessionUser,
  managerId: string,
  window: Window = "3M",
): Promise<ManagerDetail> {
  assertRole(session, "reviewing_manager", "ceo_hr");

  const m = SAMPLE_MANAGERS.find((x) => x.id === managerId) ?? SAMPLE_MANAGERS[0];

  if (m.reporteeCount < ANONYMISATION_FLOOR) {
    return {
      managerId: m.id,
      name: m.name,
      enoughData: false,
      reason: `${m.name}'s team is below ${ANONYMISATION_FLOOR} reportees, so nothing is shown — this protects anonymity.`,
      teamScore: null,
      delta: null,
      percentile: null,
      resolutionPct: null,
      pillars: [],
      trend: [],
    };
  }

  const points = Math.min(weeksIn(window), RECENT_WEEKS.length);
  const trend = buildTrend("team-" + m.id, m.base, points);
  const teamScore = trend[trend.length - 1].overall;
  const prior = trend.length > 1 ? trend[trend.length - 2].overall : null;

  return {
    managerId: m.id,
    name: m.name,
    enoughData: true,
    teamScore,
    delta: prior === null ? null : round1(teamScore - prior),
    percentile: pctFromScore(teamScore),
    resolutionPct: resolutionFor(m.id),
    pillars: pillarScoresFrom(trend),
    trend,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CEO / HR dashboard (Phase 4.3): the manager-dashboard shape applied org-wide,
// with a dropdown to drill into any department or team. Strictly aggregates —
// org / dept / team scores, never an individual, and NO participation rate next
// to any name. A scope below the anonymisation floor shows no score at all.
// ─────────────────────────────────────────────────────────────────────────────

/** A summary of feedback actions taken across a scope and their effect. */
export interface ActionImpact {
  submitted: number;
  resolved: number;
  resolutionPct: number;
  pillarsImproved: number; // pillars trending up since actions landed
}

/** One option in the scope dropdown (org → department → team). */
export interface CeoScopeOption {
  value: string;
  label: string;
  kind: "org" | "dept" | "team";
}

/** Everything the CEO / HR dashboard needs for one scope. */
export interface CeoDashboard {
  scope: string;
  scopeLabel: string;
  scopeKind: "org" | "dept" | "team";
  options: CeoScopeOption[];
  enoughData: boolean;
  reason?: string;
  score: number | null;
  delta: number | null;
  percentile: number | null;
  peopleCount: number;
  pillars: PillarScore[];
  trend: TrendPoint[];
  impact: ActionImpact | null;
}

/** Sample departments. Each holds teams (reusing SAMPLE_MANAGERS as the teams)
 *  so org / dept / team numbers stay internally consistent. Mei Tan's team sits
 *  below the floor on purpose — drilling into it shows no score. */
const SAMPLE_DEPARTMENTS: { id: string; name: string; base: number; teamIds: string[] }[] = [
  { id: "d-eng",   name: "Engineering", base: 7.5, teamIds: ["m-aria", "m-mei"] },
  { id: "d-sales", name: "Sales",       base: 6.6, teamIds: ["m-leo", "m-priya"] },
  { id: "d-ops",   name: "Operations",  base: 6.9, teamIds: ["m-tom"] },
];

function teamPeople(teamId: string): number {
  return SAMPLE_MANAGERS.find((m) => m.id === teamId)?.reporteeCount ?? 0;
}

/** Flat, ordered option list: org first, then each dept followed by its teams. */
function ceoScopeOptions(): CeoScopeOption[] {
  const opts: CeoScopeOption[] = [
    { value: "org", label: "Whole organisation", kind: "org" },
  ];
  for (const d of SAMPLE_DEPARTMENTS) {
    opts.push({ value: d.id, label: d.name, kind: "dept" });
    for (const tid of d.teamIds) {
      const t = SAMPLE_MANAGERS.find((m) => m.id === tid);
      if (t) opts.push({ value: t.id, label: `— ${t.name}`, kind: "team" });
    }
  }
  return opts;
}

/** Resolve a scope id to its label, base score, headcount and seed key. */
function resolveCeoScope(scope: string): {
  label: string;
  kind: "org" | "dept" | "team";
  base: number;
  people: number;
  seedKey: string;
} {
  if (scope === "org") {
    const people = SAMPLE_MANAGERS.reduce((s, m) => s + m.reporteeCount, 0);
    return { label: "Whole organisation", kind: "org", base: 6.9, people, seedKey: "org" };
  }
  const dept = SAMPLE_DEPARTMENTS.find((d) => d.id === scope);
  if (dept) {
    const people = dept.teamIds.reduce((s, t) => s + teamPeople(t), 0);
    return { label: dept.name, kind: "dept", base: dept.base, people, seedKey: "dept-" + dept.id };
  }
  const team = SAMPLE_MANAGERS.find((m) => m.id === scope);
  if (team) {
    return {
      label: team.name,
      kind: "team",
      base: team.base,
      people: team.reporteeCount,
      seedKey: "team-" + team.id,
    };
  }
  // Unknown scope → fall back to org-wide.
  const people = SAMPLE_MANAGERS.reduce((s, m) => s + m.reporteeCount, 0);
  return { label: "Whole organisation", kind: "org", base: 6.9, people, seedKey: "org" };
}

function impactFor(seedKey: string): ActionImpact {
  const submitted = 8 + Math.round(seeded("imp-sub-" + seedKey) * 22); // 8–30
  const resolved = Math.round(submitted * (0.5 + seeded("imp-res-" + seedKey) * 0.45));
  return {
    submitted,
    resolved,
    resolutionPct: Math.round((resolved / submitted) * 100),
    pillarsImproved: 1 + Math.round(seeded("imp-pil-" + seedKey) * 3), // 1–4
  };
}

// NOTE: superseded by the real D1 implementation in lib/ceo.ts (server-only),
// which the app now uses. This sample copy is unused and can be removed later.
export async function getCeoDashboard(
  session: SessionUser,
  scope: string = "org",
  window: Window = "3M",
): Promise<CeoDashboard> {
  assertRole(session, "ceo_hr");

  const s = resolveCeoScope(scope);
  const options = ceoScopeOptions();

  // Anonymisation floor applies at every scope — below it, no score is returned.
  if (s.people < ANONYMISATION_FLOOR) {
    return {
      scope,
      scopeLabel: s.label,
      scopeKind: s.kind,
      options,
      enoughData: false,
      reason: `${s.label} is below ${ANONYMISATION_FLOOR} responses, so nothing is shown — this protects anonymity.`,
      score: null,
      delta: null,
      percentile: null,
      peopleCount: s.people,
      pillars: [],
      trend: [],
      impact: null,
    };
  }

  const points = Math.min(weeksIn(window), RECENT_WEEKS.length);
  const trend = buildTrend(s.seedKey, s.base, points);
  const score = trend[trend.length - 1].overall;
  const prior = trend.length > 1 ? trend[trend.length - 2].overall : null;

  return {
    scope,
    scopeLabel: s.label,
    scopeKind: s.kind,
    options,
    enoughData: true,
    score,
    delta: prior === null ? null : round1(score - prior),
    percentile: pctFromScore(score),
    peopleCount: s.people,
    pillars: pillarScoresFrom(trend),
    trend,
    impact: impactFor(s.seedKey),
  };
}
