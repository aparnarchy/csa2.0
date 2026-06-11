/**
 * The 4 happiness pillars — labels, ordering, and brand colours.
 * Single source of truth so every screen labels and colours pillars identically.
 */

import type { PillarId } from "./types";

export interface PillarMeta {
  id: PillarId;
  label: string;
  /** Tailwind text colour for the pillar accent. */
  accent: string;
  /** Hex colour for charts (recharts can't read Tailwind classes). */
  hex: string;
}

export const PILLARS: Record<PillarId, PillarMeta> = {
  meaningful_work: { id: "meaningful_work", label: "Meaningful Work", accent: "text-violet-600",  hex: "#7C6FFF" },
  growth:          { id: "growth",          label: "Growth",          accent: "text-sky-600",     hex: "#0EA5E9" },
  culture:         { id: "culture",         label: "Culture",         accent: "text-emerald-600", hex: "#10B981" },
  compensation:    { id: "compensation",    label: "Compensation",    accent: "text-amber-600",   hex: "#F59E0B" },
};

/** Fixed 2×2 display order used across every dashboard. */
export const PILLAR_ORDER: PillarId[] = [
  "meaningful_work",
  "growth",
  "culture",
  "compensation",
];
