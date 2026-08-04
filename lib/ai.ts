/**
 * AI qualitative snapshot for the dashboards (Phase 5.1). SERVER-ONLY (calls
 * getDB and reads the GROQ_API_KEY secret).
 *
 * PRIVACY — only aggregate numbers ever enter the prompt: overall score,
 * delta, participation % and pillar averages. Never a name, an individual
 * score, or any free text a person wrote.
 *
 * NEVER BLOCKS A DASHBOARD — any failure (missing key, timeout, bad response)
 * returns null and the AIInsight box renders its fallback line instead.
 *
 * COST CONTROL — the generated text is cached in D1 (aiInsights) keyed by
 * scope + time window, fingerprinted by the numbers, so the LLM is only
 * called when the underlying scores change.
 */

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "./db";
import { PILLARS, PILLAR_ORDER } from "./pillars";
import type { CeoDashboard, ManagerDetail, PillarScore, TeamAggregate, Window } from "./data";
import type { PillarId } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 8000;

interface InsightFacts {
  kind: "team" | "dept" | "org";
  label: string; // never a person's name — "this team", a dept name, or the org
  score: number;
  delta: number | null;
  participation: number | null;
  pillars: PillarScore[];
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : ""}${n}`;
}

/**
 * Core generate-or-reuse. `cacheKey` identifies one dashboard scope (e.g.
 * "team-mgr:<managerId>"); each view keeps its own cache row per window
 * because each sends slightly different facts to the model.
 */
export async function getDashboardInsight(
  cacheKey: string,
  window: Window,
  facts: InsightFacts,
): Promise<string | null> {
  const scored = facts.pillars.filter((p) => p.score !== null);
  if (scored.length === 0) return null;

  const fingerprint = JSON.stringify({
    s: facts.score,
    d: facts.delta,
    p: facts.participation,
    pi: scored.map((p) => [p.pillarId, p.score, p.delta]),
  });
  const id = `${cacheKey}|${window}`;

  try {
    const db = getDB();
    const cached = await db
      .prepare("SELECT fingerprint, text FROM aiInsights WHERE id = ?")
      .bind(id)
      .first<{ fingerprint: string; text: string }>();
    if (cached && cached.fingerprint === fingerprint) return cached.text;

    const apiKey = getRequestContext().env.GROQ_API_KEY;
    if (!apiKey) return null;

    const scopeNoun = { team: "team", dept: "department", org: "organisation" }[facts.kind];
    const system =
      `You write the short "AI insight" box on a workplace-happiness dashboard for a ${scopeNoun} leader. ` +
      "Write 2-3 sentences, at most 55 words, in warm plain British English. " +
      "Name the strongest and weakest pillars and give one practical, low-effort suggestion aimed at the weakest. " +
      "Use only the numbers provided - never invent data, and never refer to individuals (the data is an anonymous aggregate). " +
      "No headings, bullet points, emojis or quotation marks.";

    const factLines = [
      `Scope: ${facts.kind === "team" ? "a team" : facts.label} over the last ${window === "All" ? "available period" : window}.`,
      `Overall happiness score: ${facts.score}/10${facts.delta !== null ? ` (${signed(facts.delta)} vs the previous week)` : ""}.`,
      facts.participation !== null ? `Check-in participation: ${facts.participation}%.` : null,
      `Pillar averages: ${scored
        .map(
          (p) =>
            `${PILLARS[p.pillarId].label} ${p.score}/10${p.delta !== null ? ` (${signed(p.delta)})` : ""}`,
        )
        .join(", ")}.`,
    ].filter(Boolean);

    const text = await callGroq(apiKey, system, factLines.join("\n"));
    if (!text) return null;

    await writeCache(id, fingerprint, text);
    return text;
  } catch {
    return null; // dashboards render their fallback line; never blocked on AI
  }
}

/** One chat completion, or null on any failure. */
async function callGroq(apiKey: string, system: string, user: string): Promise<string | null> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: 160,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim().replace(/^"|"$/g, "") ?? null;
}

async function writeCache(id: string, fingerprint: string, text: string): Promise<void> {
  await getDB()
    .prepare(
      `INSERT INTO aiInsights (id, fingerprint, text, createdAt) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET fingerprint = excluded.fingerprint,
         text = excluded.text, createdAt = excluded.createdAt`,
    )
    .bind(id, fingerprint, text, new Date().toISOString())
    .run();
}

/** Team insight for a manager's own dashboard. Skips the AI below the floor. */
export function getTeamInsight(
  managerId: string,
  window: Window,
  agg: TeamAggregate,
): Promise<string | null> {
  if (!agg.enoughData || agg.teamScore === null) return Promise.resolve(null);
  return getDashboardInsight(`team-mgr:${managerId}`, window, {
    kind: "team",
    label: "this team",
    score: agg.teamScore,
    delta: agg.delta,
    participation: agg.participation,
    pillars: agg.pillars,
  });
}

/** Team insight for the reviewing-manager detail screen. */
export function getManagerDetailInsight(
  managerId: string,
  window: Window,
  detail: ManagerDetail,
): Promise<string | null> {
  if (!detail.enoughData || detail.teamScore === null) return Promise.resolve(null);
  return getDashboardInsight(`rm-team:${managerId}`, window, {
    kind: "team",
    label: "this team",
    score: detail.teamScore,
    delta: detail.delta,
    participation: null,
    pillars: detail.pillars,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Career insight — the ✨ box on a company page. Unlike the dashboard insights
// above, this is the user's OWN data (never an aggregate), and it spans every
// company in their history plus their current job, because the whole point is
// the comparison between them.
// ─────────────────────────────────────────────────────────────────────────────

export interface CareerCompanyFacts {
  id: string;
  name: string;
  current: boolean;
  overall: number;
  /** Pillars this company has a score for; a company may not cover all four. */
  pillars: { pillarId: PillarId; score: number }[];
}

/** Highest and lowest company for one pillar, ignoring companies missing it. */
function pillarExtremes(companies: CareerCompanyFacts[], pillarId: PillarId) {
  const withPillar = companies
    .map((c) => ({ name: c.name, score: c.pillars.find((p) => p.pillarId === pillarId)?.score }))
    .filter((c): c is { name: string; score: number } => c.score !== undefined);
  if (withPillar.length < 2) return null;

  const sorted = [...withPillar].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  if (best.score === worst.score) return null; // flat — nothing to say
  return { best, worst, spread: Math.round((best.score - worst.score) * 10) / 10 };
}

/**
 * The ✨ insight for one company page.
 *
 * The comparisons are computed here — per-pillar bests and worsts, the spread,
 * and where this company ranks — and only those resolved facts go to the model,
 * which picks the interesting one and phrases it. That's deliberate: handing
 * over raw rows and asking it to compare invites invented companies and wrong
 * arithmetic. It can only talk about what's in the list it was given.
 *
 * Returns null with fewer than two companies (nothing to compare), with no API
 * key, or on any failure — the box shows its fallback line and the page is
 * never blocked.
 */
export async function getCareerInsight(
  userId: string,
  focusId: string,
  companies: CareerCompanyFacts[],
): Promise<string | null> {
  if (companies.length < 2) return null;
  const focus = companies.find((c) => c.id === focusId);
  if (!focus) return null;

  const fingerprint = JSON.stringify({
    f: focusId,
    c: companies.map((c) => [c.id, c.overall, c.pillars.map((p) => [p.pillarId, p.score])]),
  });
  const id = `career:${userId}|${focusId}`;

  try {
    const db = getDB();
    const cached = await db
      .prepare("SELECT fingerprint, text FROM aiInsights WHERE id = ?")
      .bind(id)
      .first<{ fingerprint: string; text: string }>();
    if (cached && cached.fingerprint === fingerprint) return cached.text;

    const apiKey = getRequestContext().env.GROQ_API_KEY;
    if (!apiKey) return null;

    // Resolved comparisons, widest-spread pillar first — that's the one most
    // likely to be worth a sentence.
    const comparisons = PILLAR_ORDER.map((pid) => ({ pid, ex: pillarExtremes(companies, pid) }))
      .filter((c): c is { pid: PillarId; ex: NonNullable<ReturnType<typeof pillarExtremes>> } => c.ex !== null)
      .sort((a, b) => b.ex.spread - a.ex.spread)
      .map(
        ({ pid, ex }) =>
          `${PILLARS[pid].label}: best at ${ex.best.name} (${ex.best.score}/10), weakest at ${ex.worst.name} (${ex.worst.score}/10).`,
      );

    const byOverall = [...companies].sort((a, b) => b.overall - a.overall);
    const rank = byOverall.findIndex((c) => c.id === focusId) + 1;
    const average =
      Math.round((companies.reduce((s, c) => s + c.overall, 0) / companies.length) * 10) / 10;

    const system =
      "You write the short \"AI insight\" box on someone's own career-history page, " +
      "comparing one company against the rest of their career. " +
      "Write 1-2 sentences, at most 40 words, in warm plain British English, addressed to them as \"you\". " +
      "Use ONLY the companies and numbers given - never invent an employer, a role, a date or a figure, " +
      "and never mention a company that is not in the list. " +
      "Pick the single most interesting comparison rather than listing everything. " +
      "No headings, bullet points, emojis or quotation marks.";

    const factLines = [
      `The page is about: ${focus.name}${focus.current ? " (their current job)" : ""}.`,
      `Companies in their history: ${companies.map((c) => `${c.name} ${c.overall}/10`).join(", ")}.`,
      `${focus.name} ranks ${rank} of ${companies.length} by overall score; their career average is ${average}/10.`,
      `${focus.name} pillar scores: ${focus.pillars
        .map((p) => `${PILLARS[p.pillarId].label} ${p.score}/10`)
        .join(", ")}.`,
      comparisons.length ? `Across their career - ${comparisons.join(" ")}` : null,
    ].filter(Boolean) as string[];

    const text = await callGroq(apiKey, system, factLines.join("\n"));
    if (!text) return null;

    await writeCache(id, fingerprint, text);
    return text;
  } catch {
    return null;
  }
}

/** Org / department / team insight for the CEO-HR dashboard. */
export function getCeoInsight(window: Window, d: CeoDashboard): Promise<string | null> {
  if (!d.enoughData || d.score === null) return Promise.resolve(null);
  return getDashboardInsight(`ceo:${d.scope}`, window, {
    kind: d.scopeKind,
    label: d.scopeKind === "org" ? "the whole organisation" : d.scopeLabel,
    score: d.score,
    delta: d.delta,
    participation: null,
    pillars: d.pillars,
  });
}
