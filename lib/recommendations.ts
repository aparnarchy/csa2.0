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

/** All admin-set recommendation texts, keyed by questionId. */
export async function loadRecommendations(): Promise<Map<string, string>> {
  const { results } = await getDB()
    .prepare("SELECT questionId, text FROM recommendations")
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
