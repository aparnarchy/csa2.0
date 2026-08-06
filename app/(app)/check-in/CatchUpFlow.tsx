"use client";

import { useRef, useState } from "react";
import { getSampleRecommendation, type CheckInQuestion } from "@/lib/data";
import { COPY } from "@/lib/copy";
import { skipCheckInAction, submitCheckInAction } from "./actions";

const t = COPY.catchup;

/**
 * Catch-up on questions missed in earlier weeks — presented as a CAROUSEL (dots +
 * ‹ › arrows) so it reads clearly differently from this week's full-screen check-in
 * and never feels like the same questions again. Tapping an answer records it
 * (retrospective — excluded from the streak) and auto-advances; "Skip" retires it
 * from the list. "Done" (or answering/skipping the last one) hands back to the
 * session, which continues to the dashboard.
 */
export function CatchUpFlow({
  questions,
  onDone,
}: {
  questions: CheckInQuestion[];
  onDone: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { key: string; score: number }>>({});
  const timer = useRef<number | null>(null);

  const total = questions.length;
  const q = questions[idx];
  const selected = answers[q.assignmentId];
  const answeredCount = Object.keys(answers).length;
  const allDone = answeredCount >= total;

  function clearTimer() {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function step() {
    clearTimer();
    if (idx + 1 < total) setIdx(idx + 1);
  }

  function pick(key: string, score: number) {
    setAnswers((a) => ({ ...a, [q.assignmentId]: { key, score } }));
    void submitCheckInAction(q.assignmentId, score); // retrospective (derived server-side)
    clearTimer();
    timer.current = window.setTimeout(step, 300);
  }

  function skip() {
    void skipCheckInAction(q.assignmentId);
    if (idx + 1 < total) setIdx(idx + 1);
    else onDone();
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-lav-bg px-5 pb-8 pt-6">
      {/* header — distinct from the fresh check-in */}
      <div className="text-center">
        <span className="inline-block rounded-full bg-lav-soft px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-brand">
          {t.chipPrefix}
        </span>
        <h1 className="mt-3 font-display text-[22px] font-black leading-tight text-brand">
          A few questions from earlier weeks
        </h1>
        <p className="mt-1 text-xs text-ink-3">
          {answeredCount} of {total} answered
        </p>
      </div>

      {/* progress dots */}
      <div className="mt-4 flex justify-center gap-1.5">
        {questions.map((uq, i) => (
          <span
            key={uq.assignmentId}
            className={`h-2 rounded-full transition-all ${
              answers[uq.assignmentId] ? "w-2 bg-good" : i === idx ? "w-5 bg-brand" : "w-2 bg-lav-mid"
            }`}
          />
        ))}
      </div>

      {/* the card */}
      <div className="mt-4 flex flex-1 flex-col justify-center">
        <div
          key={idx}
          className={`screen-enter rounded-card border p-4 shadow-card transition ${
            selected ? "border-good bg-good/5" : "border-transparent bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-4">{q.weekLabel ?? t.defaultWeekLabel}</span>
            {selected && (
              <span className="rounded-md bg-good/15 px-2 py-0.5 text-[10px] font-bold text-good">
                Saved
              </span>
            )}
          </div>
          <p className="mt-2 font-display text-[17px] font-black leading-snug text-ink">{q.text}</p>

          <div className="mt-4 flex flex-col gap-2">
            {q.options.map((o) => {
              const picked = selected?.key === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => pick(o.key, o.score)}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                    picked ? "border-good bg-good/10" : "border-gray-200 bg-white"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                      picked ? "bg-good text-white" : "bg-lav-soft text-brand"
                    }`}
                  >
                    {o.key}
                  </span>
                  <span className="text-[13px] leading-snug text-ink">{o.text}</span>
                </button>
              );
            })}
          </div>

          {selected && selected.score < 7 && (
            <div className="mt-3 rounded-xl bg-lav-soft p-3">
              <p className="text-[11px] font-bold text-brand">{COPY.inbox.recommendationLabel}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
                {getSampleRecommendation(q.pillarId).text}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={skip}
            className="mt-3 w-full py-1 text-center text-[12px] font-semibold text-ink-4 active:scale-95"
          >
            {t.skipButton}
          </button>
        </div>

        {/* carousel nav */}
        <div className="mt-4 flex items-center justify-between">
          <NavArrow
            dir="prev"
            disabled={idx === 0}
            onClick={() => {
              clearTimer();
              if (idx > 0) setIdx(idx - 1);
            }}
          />
          <span className="text-xs font-semibold text-ink-3">
            {idx + 1} of {total}
          </span>
          <NavArrow
            dir="next"
            disabled={idx + 1 >= total}
            onClick={step}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onDone}
        className="mt-4 w-full rounded-2xl bg-brand py-3.5 font-display text-sm font-black text-white transition active:scale-[0.98]"
      >
        {allDone ? "Done" : "Continue"}
      </button>
    </div>
  );
}

/** A subtle grey chevron for stepping through the carousel. */
function NavArrow({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous" : "Next"}
      className="flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-ink-4 transition active:scale-90 disabled:opacity-25"
    >
      {dir === "prev" ? "‹" : "›"}
    </button>
  );
}
