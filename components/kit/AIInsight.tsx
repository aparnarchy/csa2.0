/**
 * Placeholder for the AI qualitative snapshot. The real LLM call is wired in
 * Phase 5 — for now this renders the slot so screens have the right shape.
 */
export function AIInsight({ text }: { text?: string }) {
  return (
    <div className="rounded-card bg-lav-soft p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>✨</span>
        <span className="text-sm font-bold text-brand">AI insight</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        {text ?? "Your AI summary will appear here once enough check-ins are in. (Coming in Phase 5.)"}
      </p>
    </div>
  );
}
