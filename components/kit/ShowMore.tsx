import { COPY, fill } from "@/lib/copy";

/** Wins / Worries lists show 3 rows, expandable to at most 10 (owner, 2026-10-21). */
export const ROWS_COLLAPSED = 3;
export const ROWS_EXPANDED = 10;

export function visibleRows<T>(rows: T[], expanded: boolean): T[] {
  return rows.slice(0, expanded ? ROWS_EXPANDED : ROWS_COLLAPSED);
}

/** "See all N →" / "Show fewer" under a list; renders nothing when 3 or fewer rows. */
export function ShowMoreButton({
  total,
  expanded,
  onToggle,
}: {
  total: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (total <= ROWS_COLLAPSED) return null;
  return (
    <button type="button" onClick={onToggle} className="mt-1 text-xs font-bold text-brand active:opacity-70">
      {expanded ? COPY.mood.showFewer : fill(COPY.mood.seeAll, { count: Math.min(total, ROWS_EXPANDED) })}
    </button>
  );
}
