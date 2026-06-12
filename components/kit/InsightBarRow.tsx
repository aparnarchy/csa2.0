"use client";

import { useState } from "react";
import { scoreColor } from "@/lib/score-color";
import type { QuestionInsight } from "@/lib/data";

/**
 * Expandable question row: score bar; tap to reveal the A/B/C response
 * breakdown and (for concerns) a recommendation + inbox link.
 */
export function InsightBarRow({
  q,
  isStrength,
  onGoToInbox,
}: {
  q: QuestionInsight;
  isStrength: boolean;
  onGoToInbox?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const c = scoreColor(q.score);

  return (
    <div className="mb-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left"
      >
        <div className="mb-1.5 flex items-start justify-between">
          <p className="flex-1 pr-2.5 text-xs leading-snug text-ink">{q.text}</p>
          <div className="flex flex-shrink-0 items-center gap-1">
            <span className="font-display text-[17px] font-black leading-none" style={{ color: c.text }}>
              {q.score.toFixed(1)}
            </span>
            <span className="text-[9px] opacity-60" style={{ color: c.text }}>
              {open ? "▲" : "▼"}
            </span>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: c.bg }}>
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${q.score * 10}%`, background: c.text }}
          />
        </div>
      </button>

      {open && (
        <div className="mt-2 rounded-xl border bg-lav-light p-3" style={{ borderColor: c.bg }}>
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wide text-ink-3">
            Response breakdown
          </p>
          {q.responses.map((r) => (
            <div key={r.key} className="mb-1.5 flex items-center gap-2">
              <span className="w-3.5 flex-shrink-0 text-[10px] font-bold" style={{ color: c.text }}>
                {r.key}
              </span>
              <div className="flex-1">
                <p className="mb-0.5 text-[11px] text-ink-2">{r.text}</p>
                <div className="h-[5px] rounded-full" style={{ background: c.bg }}>
                  <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: c.text }} />
                </div>
              </div>
              <span className="w-8 flex-shrink-0 text-right font-display text-[11px] font-bold" style={{ color: c.text }}>
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
      )}
    </div>
  );
}
