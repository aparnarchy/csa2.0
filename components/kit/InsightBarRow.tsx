"use client";

import type { QuestionInsight } from "@/lib/data";

/**
 * Expandable question row: score bar; tap to reveal the A/B/C response
 * breakdown and (for concerns) a recommendation + inbox link.
 * Bars use uniform lavender + purple (no score colour bands), per design.
 *
 * Controlled on purpose: the parent owns which row is open so the list behaves
 * as an accordion — opening one smoothly collapses the other. The panel is
 * always mounted and animated via grid-template-rows 0fr→1fr, which transitions
 * to the content's natural height without having to measure it.
 */
export function InsightBarRow({
  q,
  isStrength,
  open,
  onToggle,
  onGoToInbox,
}: {
  q: QuestionInsight;
  isStrength: boolean;
  open: boolean;
  onToggle: () => void;
  onGoToInbox?: () => void;
}) {
  return (
    <div className="mb-2.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full text-left"
      >
        <div className="mb-1.5 flex items-start justify-between">
          <p className="flex-1 pr-2.5 text-xs leading-snug text-ink">{q.text}</p>
          <div className="flex flex-shrink-0 items-center gap-1">
            <span className="font-display text-[17px] font-black leading-none text-brand">
              {q.score.toFixed(1)}
            </span>
            <span
              className={`text-[9px] text-brand opacity-60 transition-transform duration-300 ease-out ${
                open ? "rotate-180" : ""
              }`}
            >
              ▼
            </span>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-lav-soft">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ width: `${q.score * 10}%` }}
          />
        </div>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-2 rounded-xl border border-lav-soft bg-lav-light p-3">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wide text-ink-3">
            Response breakdown
          </p>
          {q.responses.map((r) => (
            <div key={r.key} className="mb-1.5 flex items-center gap-2">
              <span className="w-3.5 flex-shrink-0 text-[10px] font-bold text-brand">
                {r.key}
              </span>
              <div className="flex-1">
                <p className="mb-0.5 text-[11px] text-ink-2">{r.text}</p>
                <div className="h-[5px] rounded-full bg-lav-soft">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${r.pct}%` }} />
                </div>
              </div>
              <span className="w-8 flex-shrink-0 text-right font-display text-[11px] font-bold text-brand">
                {r.pct}%
              </span>
            </div>
          ))}

          {!isStrength && (
            <div className="mt-2.5 rounded-xl bg-lav-soft p-3">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                Recommendation
              </p>
              <p className="mb-2.5 text-xs leading-relaxed text-ink-2">{q.recommendation}</p>
              {onGoToInbox && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGoToInbox();
                  }}
                  className="w-full rounded-[10px] bg-lav-mid py-2 text-xs font-bold text-brand active:scale-[0.98]"
                >
                  View in Inbox →
                </button>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
