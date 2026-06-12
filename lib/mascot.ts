/**
 * Mascot pose selection. The processed art lives in public/mascot/*.png.
 * Mapping is intentionally in one place so screens never hardcode it and the
 * owner can re-map poses later with a single edit.
 */
export type MascotState = "welcome" | "happy" | "sad" | "angry" | "annoyed";

/** Pick the mascot pose for a happiness score (uses the score bands). */
export function mascotForScore(score: number | null, enoughData: boolean): MascotState {
  if (!enoughData || score === null) return "welcome"; // friendly "let's get started"
  if (score >= 7) return "happy"; // green band
  if (score <= 3) return "sad"; // red band
  return "annoyed"; // amber band (4–6)
}
