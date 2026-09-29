import { COPY, fill } from "@/lib/copy";

/**
 * Small caveat under a team / department / company score when it includes
 * past answers from people who have since left. Leavers stay in history on
 * purpose (a resignation never rewrites what the team felt); this just says so.
 * Count only — never who.
 */
export function LeaverNote({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <p className="text-[11px] italic leading-snug text-ink-4">
      {fill(COPY.shared.leaverNote, { count: `${count} ${count === 1 ? "person" : "people"}` })}
    </p>
  );
}
