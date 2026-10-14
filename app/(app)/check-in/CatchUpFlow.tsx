"use client";

import { useEffect, useRef, useState } from "react";
import type { CheckInQuestion } from "@/lib/data";
import { COPY } from "@/lib/copy";
import { skipCheckInAction, submitCheckInAction } from "./actions";
import { useSaveQueue } from "./useSaveQueue";

const t = COPY.catchup;

const LEAVE_MS = 280; // matches the .q-leave animation
const HIGHLIGHT_MS = 200;

/**
 * Catch-up on questions missed in earlier weeks — presented as a CAROUSEL (dots +
 * ‹ › arrows) so it reads clearly differently from this week's full-screen check-in
 * and never feels like the same questions again. Tapping an answer records it
 * (retrospective — excluded from the streak) and glides to the next; "Skip"
 * retires it. "Continue"/"Done" skips any card left untouched (it moves to the
 * Inbox, like a skip) and hands back to the session → dashboard. Untouched
 * cards used to stay pending, so the dashboard sent the user straight back here.
 *
 * Low answers don't show their tip on the card — the session ends on the
 * recommendation card stack instead (CheckInSession, owner 2026-10-14).
 */
export function CatchUpFlow({
  questions,
  onDone,
}: {
  questions: CheckInQuestion[];
  /** The questions answered below 7 this round (empty when all were 7+). */
  onDone: (lows: CheckInQuestion[]) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { key: string; score: number }>>({});
  // Always-current copy: finish() can run from a timer set before the last
  // tap's state update lands, so it reads this instead of `answers`.
  const answersRef = useRef<Record<string, { key: string; score: number }>>({});
  const [leaving, setLeaving] = useState(false);
  const beat = useRef<number | null>(null);
  const leave = useRef<number | null>(null);
  // Submits/skips are fire-and-forget for snappy UI, but finishing leads to a
  // dashboard that re-checks "anything still unanswered?" — so finishing waits
  // for every write to land (retrying a failed one), or that check would
  // bounce the user back into catch-up. See useSaveQueue.
  const saves = useSaveQueue();
  const [saveFailed, setSaveFailed] = useState(false);

  async function finish() {
    for (const uq of questions) {
      const id = uq.assignmentId;
      if (!saves.has(id)) saves.save(id, () => skipCheckInAction(id)); // untouched → skipped
    }
    if (!(await saves.flush())) {
      setLeaving(false);
      setSaveFailed(true);
      return;
    }
    onDone(questions.filter((cq) => (answersRef.current[cq.assignmentId]?.score ?? 10) < 7));
  }

  const total = questions.length;
  const q = questions[idx];
  const selected = answers[q.assignmentId];
  const answeredCount = Object.keys(answers).length;
  const allDone = answeredCount >= total;

  function clearTimers() {
    if (beat.current) window.clearTimeout(beat.current);
    if (leave.current) window.clearTimeout(leave.current);
    beat.current = leave.current = null;
  }
  useEffect(() => () => clearTimers(), []);

  // `staysOnScreen` — see the identical note in CheckInFlow.tsx: false means
  // this step is about to unmount the whole flow (finishing on the last
  // card), so the card must NOT glide back in first, or it double-motions
  // before the hand-off to the done screen.
  function transitionTo(step: () => void, staysOnScreen: boolean) {
    clearTimers();
    setLeaving(true);
    leave.current = window.setTimeout(() => {
      if (staysOnScreen) setLeaving(false);
      step();
    }, LEAVE_MS);
  }

  function pick(key: string, score: number) {
    if (leaving) return;
    answersRef.current = { ...answersRef.current, [q.assignmentId]: { key, score } };
    setAnswers((a) => ({ ...a, [q.assignmentId]: { key, score } }));
    const id = q.assignmentId;
    saves.save(id, () => submitCheckInAction(id, score, key)); // retrospective (derived server-side)
    // glide to the next unanswered one; on the last card, stay (Done finishes).
    if (idx + 1 < total) {
      clearTimers();
      beat.current = window.setTimeout(() => transitionTo(() => setIdx(idx + 1), true), HIGHLIGHT_MS);
    }
  }

  function skip() {
    if (leaving) return;
    const id = q.assignmentId;
    saves.save(id, () => skipCheckInAction(id)); // retire it from the pending list
    const isLast = idx + 1 >= total;
    transitionTo(() => {
      if (!isLast) setIdx(idx + 1);
      else void finish();
    }, !isLast);
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

      {/* the card — glides in/out on change */}
      <div className="mt-4 flex flex-1 flex-col justify-center">
        <div
          key={idx}
          className={`${leaving ? "q-leave" : "q-enter"} rounded-card border p-4 shadow-card ${
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
                  className={`flex items-center rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.99] ${
                    picked ? "border-good bg-good/10" : "border-gray-200 bg-white"
                  }`}
                >
                  <span className="text-[13px] leading-snug text-ink">{o.text}</span>
                </button>
              );
            })}
          </div>

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
            disabled={idx === 0 || leaving}
            onClick={() => transitionTo(() => setIdx(idx - 1), true)}
          />
          <span className="text-xs font-semibold text-ink-3">
            {idx + 1} of {total}
          </span>
          <NavArrow
            dir="next"
            disabled={idx + 1 >= total || leaving}
            onClick={() => transitionTo(() => setIdx(idx + 1), true)}
          />
        </div>
      </div>

      {saveFailed && (
        <p className="mt-4 text-center text-xs font-semibold text-bad">{COPY.checkin.saveFailed}</p>
      )}
      <button
        type="button"
        onClick={() => {
          setSaveFailed(false);
          void finish();
        }}
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
