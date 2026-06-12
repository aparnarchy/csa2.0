import { PILLARS } from "@/lib/pillars";
import type { PillarId } from "@/lib/types";

/**
 * A nudge shown for a low-scoring pillar / question. `onAction` wires the
 * "I'll try this" / follow-up flow in later phases.
 */
export function RecommendationCard({
  pillarId,
  text,
  actionLabel = "Got it",
  onAction,
}: {
  pillarId?: PillarId;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const meta = pillarId ? PILLARS[pillarId] : null;
  return (
    <div className="rounded-card bg-lav-soft p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>💡</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-brand">
          {meta ? `${meta.label} tip` : "A small step"}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{text}</p>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 rounded-[10px] bg-brand px-4 py-2 text-xs font-bold text-white active:scale-[0.98]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
