"use client";

import { useState } from "react";
import { RecommendationCard } from "@/components/kit";
import { PILLARS } from "@/lib/pillars";
import { getSampleRecommendation, skipCheckIn, submitCheckIn, type CheckInQuestion } from "@/lib/data";
import type { SessionUser } from "@/lib/types";

/**
 * Catch-up on questions missed in previous weeks (oldest first). Save & next
 * records a retrospective answer (excluded from the streak); "Skip this for now"
 * moves on. A low answer (<7) shows an inline tip first.
 */
export function CatchUpFlow({
  session,
  questions,
  onDone,
}: {
  session: SessionUser;
  questions: CheckInQuestion[];
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const total = questions.length;
  const q = questions[index];
  const chosen = q.options.find((o) => o.key === selected) ?? null;
  const lowScore = chosen ? chosen.score < 7 : false;

  function advance() {
    setSelected(null);
    if (index + 1 < total) setIndex(index + 1);
    else onDone();
  }

  async function save() {
    const c = q.options.find((o) => o.key === selected);
    if (!c) return;
    await submitCheckIn(session, session.id, q.id, c.score, true); // retrospective
    advance();
  }

  async function skip() {
    await skipCheckIn(session, session.id, q.id);
    advance();
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-lav-bg px-5 pb-8 pt-5">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-300"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
        <span className="text-xs font-bold text-ink-3">
          {index + 1} of {total}
        </span>
      </div>

      <div key={index} className="screen-enter mt-8 flex-1">
        <span className="inline-block rounded-full bg-lav-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand">
          Catch-up · {q.weekLabel ?? "earlier"}
        </span>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-brand">{PILLARS[q.pillarId].label}</p>
        <h1 className="mt-2 font-display text-[26px] font-black leading-tight text-ink">{q.text}</h1>

        <div className="mt-7 space-y-3">
          {q.options.map((o) => {
            const isSel = o.key === selected;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setSelected(o.key)}
                className={`w-full rounded-2xl border p-4 text-left text-sm font-semibold transition active:scale-[0.99] ${
                  isSel
                    ? "border-brand bg-lav-soft text-brand shadow-card"
                    : "border-transparent bg-white text-ink shadow-card"
                }`}
              >
                {o.text}
              </button>
            );
          })}
        </div>

        {lowScore && (
          <div className="mt-5">
            <RecommendationCard pillarId={q.pillarId} text={getSampleRecommendation(q.pillarId).text} />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={!chosen}
        className="mt-6 w-full rounded-2xl bg-brand py-3.5 font-display text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        Save &amp; next
      </button>
      <button
        type="button"
        onClick={skip}
        className="mt-3 w-full py-1 text-center text-sm font-semibold text-ink-3 active:scale-95"
      >
        Skip this for now
      </button>
    </div>
  );
}
