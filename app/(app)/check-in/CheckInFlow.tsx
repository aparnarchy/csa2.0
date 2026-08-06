"use client";

import { useEffect, useRef, useState } from "react";
import { Mascot, OptionCard } from "@/components/kit";
import { COPY, fill } from "@/lib/copy";
import { type CheckInQuestion } from "@/lib/data";
import type { SessionUser } from "@/lib/types";
import { submitCheckInAction } from "./actions";

const t = COPY.checkin;

const LEAVE_MS = 280; // matches the .q-leave animation
const HIGHLIGHT_MS = 200; // let the tapped answer register before we glide away

/**
 * This week's fresh check-in: one question at a time, A/B/C tappable cards
 * (score hidden). Tapping an answer records it, briefly shows it selected, then
 * the question glides out to the left while the next glides in from the right —
 * a smooth hand-off, no button. The last answer glides straight on to the done
 * screen (onDone). Subtle grey ‹ › arrows step back and forth.
 */
export function CheckInFlow({
  session,
  questions,
  onDone,
}: {
  session: SessionUser;
  questions: CheckInQuestion[];
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [leaving, setLeaving] = useState(false);
  const beat = useRef<number | null>(null);
  const leave = useRef<number | null>(null);

  const first = (session.name || "there").trim().split(/\s+/)[0];
  const total = questions.length;
  const q = questions[index];
  const selected = answers[q.assignmentId] ?? null;

  function clearTimers() {
    if (beat.current) window.clearTimeout(beat.current);
    if (leave.current) window.clearTimeout(leave.current);
    beat.current = leave.current = null;
  }
  useEffect(() => () => clearTimers(), []);

  /** Play the slide-out, then run the step (advance / go back / finish). */
  function transitionTo(step: () => void) {
    clearTimers();
    setLeaving(true);
    leave.current = window.setTimeout(() => {
      setLeaving(false);
      step();
    }, LEAVE_MS);
  }

  function nextStep() {
    if (index + 1 < total) setIndex(index + 1);
    else onDone();
  }

  function pick(optionKey: string, score: number) {
    if (leaving) return;
    setAnswers((a) => ({ ...a, [q.assignmentId]: optionKey }));
    void submitCheckInAction(q.assignmentId, score);
    clearTimers();
    beat.current = window.setTimeout(() => transitionTo(nextStep), HIGHLIGHT_MS);
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-lav-bg px-6 pb-8 pt-5">
      {/* top: subtle grey back / forward arrows + step counter */}
      <div className="flex items-center justify-between">
        <NavArrow
          dir="prev"
          disabled={index === 0 || leaving}
          onClick={() => transitionTo(() => setIndex(index - 1))}
        />
        <span className="text-xs font-bold text-ink-3">
          {index + 1} of {total}
        </span>
        <NavArrow dir="next" disabled={!selected || leaving} onClick={() => transitionTo(nextStep)} />
      </div>

      {/* greeting + question, vertically centred — glides in/out on change */}
      <div
        key={index}
        className={`${leaving ? "q-leave" : "q-enter"} flex flex-1 flex-col justify-center`}
      >
        <div className="flex flex-col items-center text-center">
          <Mascot state="welcome" size={198} float={false} />
          <p className="mt-2 font-display text-base font-black text-brand">
            {fill(t.greeting, { name: first })}
          </p>
          <h1 className="mt-2 font-display text-[24px] font-bold leading-snug text-brand">{q.text}</h1>
        </div>

        <div className="mt-8 space-y-3">
          {q.options.map((o) => (
            <OptionCard
              key={o.key}
              optionKey={o.key}
              text={o.text}
              selected={o.key === selected}
              onClick={() => pick(o.key, o.score)}
            />
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-ink-4">
        {selected ? "Saved — moving on…" : "Tap an answer to continue"}
      </p>
    </div>
  );
}

/** A subtle grey chevron for stepping between questions. */
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
      aria-label={dir === "prev" ? "Previous question" : "Next question"}
      className="flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-ink-4 transition active:scale-90 disabled:opacity-25"
    >
      {dir === "prev" ? "‹" : "›"}
    </button>
  );
}
