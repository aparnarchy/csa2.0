/**
 * Mascot pose selection. The processed art lives in public/mascot/*.png.
 * Mapping is intentionally in one place so screens never hardcode it and the
 * owner can re-map poses later with a single edit.
 *
 * NOTE: "annoyed" is temporarily not produced (its source art is being redone),
 * so it isn't returned here yet.
 */
export type MascotState = "welcome" | "happy" | "sad" | "angry";

/** Pick the mascot pose for a happiness score. */
export function mascotForScore(score: number | null, enoughData: boolean): MascotState {
  if (!enoughData || score === null) return "welcome"; // friendly "let's get started"
  if (score >= 7) return "happy"; // good score
  return "sad"; // low score → sad mascot
}
