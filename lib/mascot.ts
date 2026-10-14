/**
 * Mascot pose selection. The mascot is drawn in code
 * (components/kit/AnswerMascot.tsx — MascotArt).
 * Mapping is intentionally in one place so screens never hardcode it and the
 * owner can re-map poses later with a single edit.
 *
 * NOTE: "annoyed" is temporarily not produced (its source art is being redone),
 * so it isn't returned here yet.
 */
import { scoreLevel } from "./mood";

export type MascotState = "welcome" | "happy" | "sad" | "angry";

/** Standard mascot size for screen headers (dashboard, pillar, welcome-back). */
export const HEADER_MASCOT_SIZE = 120;

/**
 * Pick the mascot pose for a happiness score, following the same levels as
 * every headline and colour (lib/mood.ts): good → happy, mixed → the neutral
 * welcome pose, low → sad, no data → welcome ("let's get started").
 */
export function mascotForScore(score: number | null, enoughData: boolean): MascotState {
  if (!enoughData) return "welcome";
  const level = scoreLevel(score);
  if (level === "good") return "happy";
  if (level === "low") return "sad";
  return "welcome";
}
