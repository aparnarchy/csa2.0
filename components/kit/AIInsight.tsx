/**
 * The AI qualitative snapshot box. Screens pass `text` from the server-side
 * insight (lib/ai.ts); when it's missing (below the anonymity floor, no key,
 * or the AI call failed) the fallback line renders instead — a dashboard is
 * never blocked on the AI.
 *
 * Deliberately the loudest card on the page: a raised, bordered card (not the
 * flat lav-soft fill everything else uses) with the insight itself set big,
 * bold and brand-purple — it should read as the one thing to look at first.
 */
import { COPY } from "@/lib/copy";

export function AIInsight({ text }: { text?: string }) {
  return (
    <div className="rounded-card border-2 border-brand/20 bg-white p-4 shadow-[0_8px_24px_-8px_rgba(124,111,255,0.45)]">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>✨</span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-brand">
          {COPY.shared.aiInsightTitle}
        </span>
      </div>
      <p className="mt-2 font-display text-[17px] font-black leading-snug text-brand">
        {text ?? COPY.shared.aiInsightFallback}
      </p>
    </div>
  );
}
