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
import { PILLARS } from "./pillars";
import type { CeoDashboard, ManagerDetail, PillarScore, TeamAggregate, Window } from "./data";

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

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: factLines.join("\n") },
        ],
        temperature: 0.4,
        max_tokens: 160,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim().replace(/^"|"$/g, "");
    if (!text) return null;

    await db
      .prepare(
        `INSERT INTO aiInsights (id, fingerprint, text, createdAt) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET fingerprint = excluded.fingerprint,
           text = excluded.text, createdAt = excluded.createdAt`,
      )
      .bind(id, fingerprint, text, new Date().toISOString())
      .run();
    return text;
  } catch {
    return null; // dashboards render their fallback line; never blocked on AI
  }
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
