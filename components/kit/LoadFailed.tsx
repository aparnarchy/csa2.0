import { COPY } from "@/lib/copy";

/** In place of a screen's content when loading it failed even after a retry:
 *  says so plainly and offers another go, instead of an endless spinner. */
export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="w-full rounded-card bg-white p-5 text-center shadow-card transition active:scale-[0.99]"
    >
      <p className="text-sm font-semibold text-ink-2">{COPY.shared.loadFailed}</p>
      <p className="mt-1.5 text-xs font-bold text-brand">{COPY.shared.loadFailedRetry}</p>
    </button>
  );
}
