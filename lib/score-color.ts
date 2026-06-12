/**
 * Shared score → colour mapping, so every screen colours scores identically.
 * Bands are LOCKED (CLAUDE.md): >=7 green, 4–6 amber, <=3 red.
 * Returns hex values (charts/SVG can't read Tailwind classes) that match the
 * --color-good/warn/bad tokens in globals.css.
 */

import { scoreBand } from "./scoring";

export interface ScoreColor {
  band: "green" | "amber" | "red";
  text: string;
  bg: string;
}

const MAP: Record<ScoreColor["band"], { text: string; bg: string }> = {
  green: { text: "#059669", bg: "#E8FBF0" },
  amber: { text: "#B45309", bg: "#FEF3E2" },
  red:   { text: "#DC2626", bg: "#FDECEC" },
};

export function scoreColor(score: number): ScoreColor {
  const band = scoreBand(score);
  return { band, ...MAP[band] };
}
