/**
 * Real, admin-authored recommendation text (server-only), backing the
 * `recommendations` table. Every consumer loads the whole table in one query
 * (there are only ever ~15 questions) and looks up per question in memory,
 * rather than one query per question. A question the admin hasn't written one
 * for gets NO recommendation (empty string) — never a generic stand-in, which
 * read as irrelevant to the question asked (owner, 2026-10-14). Every screen
 * hides its recommendation box when the text is empty.
 */

import { getDB } from "@/lib/db";
import type { PillarId } from "@/lib/types";

export type RecommendationAudience = "employee" | "manager";

/** All admin-set recommendation texts for one audience, keyed by questionId.
 *  Employee and manager read different coaching text for the same question
 *  (one addressed to them, one addressed to their manager about them), so
 *  every caller must say which audience it's rendering for. */
export async function loadRecommendations(
  audience: RecommendationAudience,
): Promise<Map<string, string>> {
  const { results } = await getDB()
    .prepare("SELECT questionId, text FROM recommendations WHERE audience = ?")
    .bind(audience)
    .all<{ questionId: string; text: string }>();
  return new Map(results.map((r) => [r.questionId, r.text]));
}

/** The admin-written recommendation for this question, or "" if there isn't
 *  one yet. (pillarId is kept so callers needn't change; it's no longer used.) */
export function pickRecommendation(
  map: Map<string, string>,
  questionId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pillarId: PillarId,
): string {
  return map.get(questionId)?.trim() ?? "";
}

/** SQL fragment: only check-ins whose question has an employee recommendation.
 *  An open "did you act on it?" follow-up only makes sense when there was a
 *  recommendation to act on. Append to a WHERE on checkIns aliased `alias`. */
export function hasEmployeeRecSql(alias: string): string {
  return `${alias}questionId IN (SELECT questionId FROM recommendations WHERE audience = 'employee' AND trim(text) <> '')`;
}
