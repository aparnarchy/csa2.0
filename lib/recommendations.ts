/**
 * Real, admin-authored recommendation text (server-only), backing the
 * `recommendations` table. Every consumer loads the whole table in one query
 * (there are only ever ~15 questions) and looks up per question in memory,
 * rather than one query per question. Falls back to the generic pillar-level
 * placeholder in lib/data.ts for any question the admin hasn't written one
 * for yet, so nothing ever breaks while content is still being filled in.
 */

import { getDB } from "@/lib/db";
import { getSampleRecommendation } from "@/lib/data";
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

/** The real recommendation for this question if one's been written, else the
 *  generic pillar-level placeholder. */
export function pickRecommendation(
  map: Map<string, string>,
  questionId: string,
  pillarId: PillarId,
): string {
  return map.get(questionId) ?? getSampleRecommendation(pillarId).text;
}
