import { ANONYMISATION_FLOOR } from "@/lib/scoring";

/**
 * Shown whenever a score is below the response floor. We deliberately show
 * this — not a 0 — so a sparse window never looks like a bad score.
 */
export function NotEnoughData({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center">
      <span className="text-3xl" aria-hidden>📭</span>
      <p className="mt-2 text-base font-medium text-gray-700">Not enough data yet</p>
      <p className="mt-1 text-sm text-gray-500">
        {message ?? `We need at least ${ANONYMISATION_FLOOR} responses before showing a score.`}
      </p>
    </div>
  );
}
