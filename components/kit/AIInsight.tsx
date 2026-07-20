/**
 * The AI qualitative snapshot box. Screens pass `text` from the server-side
 * insight (lib/ai.ts); when it's missing (below the anonymity floor, no key,
 * or the AI call failed) the fallback line renders instead — a dashboard is
 * never blocked on the AI.
 */
import { COPY } from "@/lib/copy";

export function AIInsight({ text }: { text?: string }) {
  return (
    <div className="rounded-card bg-lav-soft p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>✨</span>
        <span className="text-sm font-bold text-brand">{COPY.shared.aiInsightTitle}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        {text ?? COPY.shared.aiInsightFallback}
      </p>
    </div>
  );
}
