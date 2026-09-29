/**
 * One place that turns a score into its mood — the level, the headline, the
 * big-score tagline and the Bright spot / Watch out labels — so the words on
 * every dashboard always agree with the number next to them.
 *
 * Levels follow the locked colour bands (lib/scoring.ts scoreBand):
 *   good  = 7 and above, mixed = 4 to 6.9, low = below 4, and null = no data.
 * All wording lives in copy/copy.html (the "mood" section) so the owner can
 * edit it; this file only decides WHICH line applies.
 */
import { COPY } from "./copy";
import { scoreBand } from "./scoring";
import type { Persona } from "./types";

export type ScoreLevel = "good" | "mixed" | "low";
export type TrendDir = "up" | "steady" | "down";

/** The score's level, or null when there's no score (no data yet). */
export function scoreLevel(score: number | null | undefined): ScoreLevel | null {
  if (score === null || score === undefined) return null;
  const band = scoreBand(score);
  return band === "green" ? "good" : band === "amber" ? "mixed" : "low";
}

/** Direction of change; a missing or tiny change counts as steady. */
export function trendDir(delta: number | null | undefined): TrendDir {
  if (delta === null || delta === undefined) return "steady";
  if (delta >= 0.2) return "up";
  if (delta <= -0.2) return "down";
  return "steady";
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The hero headline under the greeting, picked from level AND direction (so a
 * low-but-steady score never reads as "holding the line"). Null score → the
 * "no check-ins yet" title.
 */
export function moodHeadline(score: number | null, delta: number | null, persona?: Persona): string {
  const level = scoreLevel(score);
  if (!level) return COPY.mood.noDataTitle;
  const voice = persona ?? "plain";
  const key = `${voice}${cap(level)}${cap(trendDir(delta))}` as keyof typeof COPY.mood;
  return COPY.mood[key];
}

/** The one-line tagline under a big score. */
export function scoreTagline(score: number | null): string {
  const level = scoreLevel(score);
  if (!level) return COPY.mood.noDataTitle;
  return { good: COPY.mood.taglineGood, mixed: COPY.mood.taglineMixed, low: COPY.mood.taglineLow }[level];
}

/** Label for the highest pillar: only a real bright spot if it's actually good. */
export function topLabel(score: number): string {
  return scoreLevel(score) === "good" ? COPY.mood.brightSpot : COPY.mood.strongestArea;
}

/** Label for the lowest pillar: only "watch out" if it's actually below good. */
export function bottomLabel(score: number): string {
  return scoreLevel(score) === "good" ? COPY.mood.lowestArea : COPY.mood.watchOut;
}

/** "Based on 3 answers — …" while a score rests on only a few answers. */
export const EARLY_READ_BELOW = 8;
export function earlyReadNote(count: number): string | null {
  if (count <= 0 || count >= EARLY_READ_BELOW) return null;
  return COPY.mood.earlyRead.replace("{count}", `${count} ${count === 1 ? "answer" : "answers"}`);
}
