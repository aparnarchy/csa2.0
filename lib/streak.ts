/**
 * Streak + activity dots, worked out from the person's own check-ins so the
 * two always agree (owner, 2026-10-28: the row ran the wrong way, counted
 * weeks under a "day streak" label, and the stored streak never reset).
 *
 * A "period" is a day while TESTING_MODE hands out a question a day, else a
 * week. Catch-up (retrospective) answers don't count, as everywhere else.
 * Pure: no database access, so it's easy to reason about.
 */

export type PeriodUnit = "day" | "week";
export type Dot = "done" | "missed" | "upcoming";

export interface Activity {
  unit: PeriodUnit;
  current: number;
  longest: number;
  /** Always 10 slots, oldest first, starting at their first period. Once
      they've been around 10+ periods it shows the latest 10. */
  dots: Dot[];
  /** Index in `dots` of the current period (today / this week), or -1. */
  todayIndex: number;
}

const SLOTS = 10;

/**
 * @param answered  period keys with an on-time answer (any order)
 * @param periods   every period key that has started, oldest first, ending
 *                  with the current one
 */
export function buildActivity(unit: PeriodUnit, answered: Set<string>, periods: string[]): Activity {
  const firstIdx = periods.findIndex((p) => answered.has(p));
  if (firstIdx === -1) {
    return { unit, current: 0, longest: 0, dots: Array(SLOTS).fill("upcoming"), todayIndex: -1 };
  }
  const mine = periods.slice(firstIdx); // from their first check-in to now
  const last = mine.length - 1;

  // Current streak: consecutive answered periods ending now. The current
  // period still being open (not answered yet) doesn't break it.
  let current = 0;
  for (let i = answered.has(mine[last]) ? last : last - 1; i >= 0 && answered.has(mine[i]); i--) current++;

  let longest = 0;
  let run = 0;
  for (const p of mine) {
    run = answered.has(p) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  const shown = mine.slice(-SLOTS);
  const dots: Dot[] = shown.map((p, i) =>
    answered.has(p) ? "done" : i === shown.length - 1 ? "upcoming" : "missed",
  );
  const todayIndex = dots.length - 1;
  while (dots.length < SLOTS) dots.push("upcoming");
  return { unit, current, longest, dots, todayIndex };
}

/** Every UTC day from `firstISO` (a date or timestamp) through today, oldest first. */
export function daysSince(firstISO: string, today = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(`${firstISO.slice(0, 10)}T00:00:00Z`);
  const end = today.toISOString().slice(0, 10);
  for (let i = 0; i < 4000; i++) {
    const key = d.toISOString().slice(0, 10);
    out.push(key);
    if (key >= end) break;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
