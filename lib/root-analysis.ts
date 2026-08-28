/**
 * "Find the Root" — Phase 3: turning Phase 2's real facts into the actual
 * root-cause narrative via Groq. SERVER-ONLY. Follows the exact safety
 * pattern already proven in lib/ai.ts for every other AI surface: cache by
 * fingerprint, 8-second timeout, any failure or validation miss returns the
 * deterministic engine's output instead — never blocked, never broken, and
 * the deterministic four-entry knowledge base stays as the guaranteed floor
 * (Phase 4), not legacy debt.
 *
 * Two containment checks guard against the two ways a model can break trust
 * here (owner was explicit that this must be "genuinely insightful, not a
 * random prediction engine"):
 *  - It must choose an action from the real admin-authored recommendation
 *    candidates, never write its own. Enforced by construction: the model
 *    returns an INDEX into the candidate list, not text, so there is no
 *    free-text action to validate — it's structurally impossible to invent one.
 *  - It must not cite a number we didn't give it. Enforced by scanning the
 *    response for digit-numbers and rejecting anything outside an explicit
 *    allow-list built from the real facts (falls back to deterministic on a
 *    miss). This is a real but not exhaustive guard — see the comment on
 *    validate() for what it does and doesn't catch.
 */

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "./db";
import { gatherRootFacts, type RootFacts } from "./root-facts";
import { buildRootAnalysis, type RootAnalysis } from "./rca";
import { PILLARS } from "./pillars";
import type { EmployeeScores } from "./data";
import type { Persona, PillarId, SessionUser } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// See the matching comment in lib/ai.ts — llama-3.3-70b-versatile no longer
// exists on Groq; this is the same fix applied here.
const MODEL = "openai/gpt-oss-120b";
const TIMEOUT_MS = 8000;

/** The exact JSON shape the model must return. */
interface ModelOutput {
  hookLine: string;
  hookSub: string;
  feelings: string[];
  symptomTitle: string;
  symptomBody: string;
  factorBody: string;
  rootBody: string;
  actionIndex: number;
  payoff: string;
}

const PERSONA_VOICE: Record<"neutral" | Persona, string> = {
  neutral: "Write in a warm, plain, encouraging tone.",
  spiderman:
    "Write in the voice of a witty, warm, encouraging Spider-Man — light quips and hero " +
    "metaphors are welcome, but never invent a fact or detail to fit the bit.",
  batman:
    "Write in the voice of a terse, focused Batman — clipped sentences, mission language — " +
    "but never invent a fact or detail to fit the character.",
};

/**
 * The real, AI-reasoned root-cause analysis for this person, or the
 * deterministic fallback if there isn't enough data, the AI call fails, or
 * its response doesn't pass validation. `data` is only used for that
 * fallback's shape — the AI path gathers its own facts (1-month window, per
 * owner decision) via gatherRootFacts.
 */
export async function getRootAnalysis(
  session: SessionUser,
  userId: string,
  data: EmployeeScores,
  persona?: Persona,
): Promise<RootAnalysis> {
  const fallback = () => buildRootAnalysis(data, persona);

  const facts = await gatherRootFacts(session, userId);
  if (!facts.enough || !facts.weakestPillar || !facts.weakestQuestion) return fallback();
  if (facts.candidateRecommendations.length === 0) return fallback();

  const pillarId = facts.weakestPillar;
  const voice = persona ?? "neutral";
  const fingerprint = JSON.stringify({ facts, voice });
  const id = `rca:${userId}:${voice}`;

  try {
    const db = getDB();
    const cached = await db
      .prepare("SELECT fingerprint, text FROM aiInsights WHERE id = ?")
      .bind(id)
      .first<{ fingerprint: string; text: string }>();
    if (cached && cached.fingerprint === fingerprint) {
      const parsed = toRootAnalysis(safeParse(cached.text), facts, pillarId);
      if (parsed) return parsed;
    }

    const apiKey = getRequestContext().env.GROQ_API_KEY;
    if (!apiKey) return fallback();

    const system = buildSystemPrompt(voice);
    const user = buildFactLines(facts);

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.5,
        // gpt-oss is a reasoning model — reasoning tokens count against this
        // budget before the visible JSON answer, tested at ~200 total tokens
        // for this shape, so 1400 leaves generous headroom.
        max_tokens: 1400,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return fallback();

    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) return fallback();

    const result = toRootAnalysis(safeParse(raw), facts, pillarId);
    if (!result) return fallback();

    await db
      .prepare(
        `INSERT INTO aiInsights (id, fingerprint, text, createdAt) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET fingerprint = excluded.fingerprint,
           text = excluded.text, createdAt = excluded.createdAt`,
      )
      .bind(id, fingerprint, raw, new Date().toISOString())
      .run();

    return result;
  } catch {
    return fallback(); // never blocks the journey — same rule as every other AI surface
  }
}

function safeParse(raw: string): ModelOutput | null {
  try {
    return JSON.parse(raw) as ModelOutput;
  } catch {
    return null;
  }
}

function buildSystemPrompt(voice: "neutral" | Persona): string {
  return (
    "You are the \"Find the Root\" feature on a workplace-happiness app, writing directly " +
    "to the one person this data belongs to. Your job is to explain, in a short guided " +
    "narrative, the most plausible root cause behind their weakest area right now — " +
    "genuinely insightful, grounded in the real facts given, never a generic or random " +
    "guess.\n\n" +
    "Rules, no exceptions:\n" +
    "- Use ONLY the facts given below. Never invent a company, a question, a score, a " +
    "date, or any detail not present in the facts.\n" +
    "- \"actionIndex\" must be the array index (starting at 0) of ONE item from the " +
    "candidateRecommendations list given to you — you are choosing, never writing your own.\n" +
    "- Tone: provocative-but-kind. Name a real feeling and its quiet downstream cost, hedge " +
    "with \"you might\", and always end on something hopeful and doable. Never blunt-doom.\n" +
    `- ${PERSONA_VOICE[voice]}\n` +
    "- Keep every field short: hookLine and hookSub each under 20 words; symptomBody, " +
    "factorBody and rootBody each 1-2 sentences; payoff 1 sentence; feelings is 2-3 short " +
    "words/phrases.\n\n" +
    "Respond with ONLY a JSON object matching exactly this shape: " +
    '{"hookLine": string, "hookSub": string, "feelings": string[], "symptomTitle": string, ' +
    '"symptomBody": string, "factorBody": string, "rootBody": string, "actionIndex": number, ' +
    '"payoff": string}'
  );
}

function buildFactLines(facts: RootFacts): string {
  const pillarId = facts.weakestPillar!;
  const lines: string[] = [
    `Weakest area: ${PILLARS[pillarId].label}, currently scoring ${facts.weakestPillarScore}/10.`,
    `Trend over the past month: ${facts.weakestPillarTrend ?? "not enough data to tell"}` +
      (facts.weakestPillarDelta !== null ? ` (${facts.weakestPillarDelta >= 0 ? "+" : ""}${facts.weakestPillarDelta} vs a month ago)` : "") +
      ".",
    `Their single lowest-scoring question in this area: "${facts.weakestQuestion!.text}" at ${facts.weakestQuestion!.score}/10.`,
  ];
  if (facts.lowStreak > 1) {
    lines.push(`This question has scored below 7 for ${facts.lowStreak} check-ins in a row.`);
  }
  if (facts.priorAction) {
    const a = facts.priorAction;
    lines.push(
      `Their manager already took an action on this exact area, visible to them since ${a.visibleSinceLabel}: "${a.actionText}". ` +
        (a.movedUp === null
          ? "Not enough data yet to tell if it's helped."
          : a.movedUp
            ? `Their score in this area has gone UP since then (from about ${a.scoreBefore?.toFixed(1)} to ${a.scoreAfter?.toFixed(1)}).`
            : `Their score in this area has NOT improved since then (about ${a.scoreBefore?.toFixed(1)} before, ${a.scoreAfter?.toFixed(1)} since).`),
    );
  }
  if (facts.careerComparison) {
    const c = facts.careerComparison;
    lines.push(
      `Across their whole career, in this same area: best at ${c.bestCompany} (${c.bestScore}/10), weakest at ${c.worstCompany} (${c.worstScore}/10).` +
        (c.currentIsWorst ? " Their CURRENT company is the weakest point in their career for this area." : ""),
    );
  }
  if (facts.journalReflections.length > 0) {
    lines.push(
      "Their own words, from reflections they wrote after a recent low score in this area " +
        `(use these to understand how they actually feel, do not quote them verbatim): ` +
        facts.journalReflections.map((t) => `"${t}"`).join(" / "),
    );
  }
  lines.push(
    "candidateRecommendations (choose actionIndex from this list, 0-based): " +
      facts.candidateRecommendations.map((t, i) => `[${i}] ${t}`).join(" "),
  );
  return lines.join("\n");
}

/**
 * Turns validated model output into the app's real RootAnalysis shape, or
 * null if it fails validation (caller falls back to deterministic).
 *
 * What this DOES catch: a fabricated action (impossible by construction —
 * actionIndex must resolve to a real candidate), and any digit-number in the
 * narrative that isn't in the explicit allow-list built from real facts (the
 * fixed /10 scale is always allowed).
 *
 * What this DOESN'T catch: a fabricated company name when a real one wasn't
 * given (career comparison is only ever mentioned in the prompt when real
 * data exists, so there's nothing for the model to riff off — but this is a
 * prompt-level mitigation, not a hard validation, since reliable free-text
 * entity extraction is its own project). Flagged here rather than silently
 * assumed solved.
 */
function toRootAnalysis(out: ModelOutput | null, facts: RootFacts, pillarId: PillarId): RootAnalysis | null {
  if (!out) return null;
  if (
    typeof out.hookLine !== "string" ||
    typeof out.hookSub !== "string" ||
    !Array.isArray(out.feelings) ||
    typeof out.symptomTitle !== "string" ||
    typeof out.symptomBody !== "string" ||
    typeof out.factorBody !== "string" ||
    typeof out.rootBody !== "string" ||
    typeof out.payoff !== "string" ||
    typeof out.actionIndex !== "number"
  ) {
    return null;
  }
  const action = facts.candidateRecommendations[out.actionIndex];
  if (!action) return null; // out-of-range index — cannot resolve to a real candidate

  const allowedNumbers = new Set<string>(["10"]); // the fixed A/B/C scale's denominator
  const push = (n: number | null | undefined) => {
    if (n !== null && n !== undefined) allowedNumbers.add(n.toFixed(1)).add(String(Math.round(n)));
  };
  push(facts.weakestPillarScore);
  push(facts.weakestPillarDelta);
  push(facts.weakestQuestion?.score);
  push(facts.lowStreak);
  push(facts.priorAction?.scoreBefore);
  push(facts.priorAction?.scoreAfter);
  push(facts.careerComparison?.bestScore);
  push(facts.careerComparison?.worstScore);

  const narrative = [out.hookLine, out.hookSub, out.symptomBody, out.factorBody, out.rootBody, out.payoff].join(" ");
  const numbersInText = narrative.match(/\d+(\.\d+)?/g) ?? [];
  for (const n of numbersInText) {
    const normalized = n.includes(".") ? Number(n).toFixed(1) : n;
    if (!allowedNumbers.has(normalized) && !allowedNumbers.has(String(Number(n)))) return null;
  }

  return {
    available: true,
    pillarId,
    hook: { line: out.hookLine, sub: out.hookSub },
    feelings: out.feelings.filter((f) => typeof f === "string").slice(0, 3),
    nodes: [
      { depthLabel: "The feeling", title: out.symptomTitle, body: out.symptomBody },
      { depthLabel: "Where it lives", title: PILLARS[pillarId].label, body: out.factorBody },
      {
        depthLabel: "The root",
        title: "Here's the root",
        body: out.rootBody,
        evidence: `Your lowest signal: "${facts.weakestQuestion!.text}"`,
        isRoot: true,
      },
    ],
    actions: [action],
    payoff: out.payoff,
  };
}
