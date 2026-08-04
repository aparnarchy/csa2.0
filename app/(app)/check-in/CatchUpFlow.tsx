"use client";

import { useState } from "react";
import { Mascot, OptionCard, RecommendationCard } from "@/components/kit";
import { COPY } from "@/lib/copy";
import { getSampleRecommendation, skipCheckIn, type CheckInQuestion } from "@/lib/data";
import type { SessionUser } from "@/lib/types";
import { submitCheckInAction } from "./actions";

const t = COPY.catchup;

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
    await submitCheckInAction(q.id, c.score, true); // retrospective
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

      <div key={index} className="screen-enter flex flex-1 flex-col justify-center">
        <div className="flex flex-col items-center text-center">
          <Mascot state="welcome" size={146} float={false} />
          <span className="mt-3 inline-block rounded-full bg-lav-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand">
            {t.chipPrefix} · {q.weekLabel ?? t.defaultWeekLabel}
          </span>
          <h1 className="mt-3 font-display text-[24px] font-bold leading-snug text-brand">{q.text}</h1>
        </div>

        <div className="mt-8 space-y-3">
          {q.options.map((o) => (
            <OptionCard
              key={o.key}
              optionKey={o.key}
              text={o.text}
              selected={o.key === selected}
              onClick={() => setSelected(o.key)}
            />
          ))}
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
        {t.saveButton}
      </button>
      <button
        type="button"
        onClick={skip}
        className="mt-3 w-full py-1 text-center text-sm font-semibold text-ink-3 active:scale-95"
      >
        {t.skipButton}
      </button>
    </div>
  );
}
