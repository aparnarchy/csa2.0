/**
 * The AI qualitative snapshot box. Screens pass `text` from the server-side
 * insight (lib/ai.ts); when it's missing (below the anonymity floor, no key,
 * or the AI call failed) the fallback line renders instead — a dashboard is
 * never blocked on the AI.
 *
 * The actual AI text is a real 2-3 sentence, ~55-word paragraph (see the
 * prompt in lib/ai.ts) — setting a whole paragraph in bold brand-purple reads
 * as a wall of text, not an insight. The "flashy" part lives in the CONTAINER
 * (gradient card, icon badge, glow, bold uppercase eyebrow) instead, so the
 * body text can stay normal-weight and readable.
 */
import { COPY } from "@/lib/copy";

export function AIInsight({ text }: { text?: string }) {
  return (
    <div
      className="rounded-card border border-brand/15 p-4 shadow-[0_8px_24px_-8px_rgba(124,111,255,0.35)]"
      style={{ background: "linear-gradient(155deg, #ffffff 0%, #F5F3FF 100%)" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand text-xs text-white"
          aria-hidden
        >
          ✨
        </span>
        <span className="text-[11px] font-black uppercase tracking-wide text-brand">
          {COPY.shared.aiInsightTitle}
        </span>
      </div>
      <p className="mt-2.5 text-[14px] font-semibold leading-relaxed text-ink-2">
        {text ?? COPY.shared.aiInsightFallback}
      </p>
    </div>
  );
}
