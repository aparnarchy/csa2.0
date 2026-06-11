/**
 * Placeholder for the AI qualitative snapshot. The real LLM call is wired in
 * Phase 5 — for now this renders the slot so screens have the right shape.
 */
export function AIInsight({ text }: { text?: string }) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>✨</span>
        <span className="text-sm font-semibold text-violet-700">AI insight</span>
      </div>
      <p className="mt-2 text-base text-violet-900/80">
        {text ?? "Your AI summary will appear here once enough check-ins are in. (Coming in Phase 5.)"}
      </p>
    </div>
  );
}
