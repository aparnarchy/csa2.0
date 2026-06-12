import { ANONYMISATION_FLOOR } from "@/lib/scoring";

/**
 * Shown whenever a score is below the response floor. We deliberately show
 * this — not a 0 — so a sparse window never looks like a bad score.
 */
export function NotEnoughData({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-lav-mid bg-lav-light px-6 py-8 text-center">
      <span className="text-3xl" aria-hidden>📭</span>
      <p className="mt-2 text-base font-bold text-ink">Not enough data yet</p>
      <p className="mt-1 text-sm text-ink-3">
        {message ?? `We need at least ${ANONYMISATION_FLOOR} responses before showing a score.`}
      </p>
    </div>
  );
}
