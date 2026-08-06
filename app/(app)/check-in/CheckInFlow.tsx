"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot, OptionCard, RecommendationCard } from "@/components/kit";
import { COPY, fill } from "@/lib/copy";
import { getSampleRecommendation, type CheckInQuestion } from "@/lib/data";
import type { SessionUser } from "@/lib/types";
import { submitCheckInAction } from "./actions";

const t = COPY.checkin;

/**
 * The weekly check-in: one question at a time, A/B/C tappable cards (score
 * hidden). A low answer (<7) shows an inline tip before continuing. Focused
 * full-screen flow — no bottom nav.
 */
export function CheckInFlow({
  session,
  questions,
}: {
  session: SessionUser;
  questions: CheckInQuestion[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const first = (session.name || "there").trim().split(/\s+/)[0];
  const total = questions.length;

  if (total === 0 || done) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center gap-5 bg-lav-bg px-8 text-center">
        <Mascot state="happy" size={150} />
        <div>
          <h1 className="font-display text-2xl font-black text-brand">
            {total === 0 ? t.doneAllCaughtUpTitle : fill(t.doneNiceWorkTitle, { name: first })}
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            {total === 0 ? t.doneAllCaughtUpBody : t.doneLoggedBody}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard/employee")}
          className="w-full rounded-2xl bg-brand py-3.5 font-display text-sm font-black text-white active:scale-[0.98]"
        >
          {t.seeDashboardButton}
        </button>
      </div>
    );
  }

  const q = questions[index];
  const chosen = q.options.find((o) => o.key === selected) ?? null;
  const lowScore = chosen ? chosen.score < 7 : false;

  async function next() {
    const c = q.options.find((o) => o.key === selected);
    if (!c) return;
    await submitCheckInAction(q.assignmentId, c.score);
    setSelected(null);
    if (index + 1 < total) setIndex(index + 1);
    else setDone(true);
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-lav-bg px-6 pb-8 pt-5">
      {/* top bar: back + step */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/dashboard/employee")}
          className="text-sm font-semibold text-ink-3 active:scale-95"
        >
          {t.backLink}
        </button>
        {total > 1 && (
          <span className="text-xs font-bold text-ink-3">
            {index + 1} of {total}
          </span>
        )}
      </div>

      {/* greeting + question, vertically centred */}
      <div key={index} className="screen-enter flex flex-1 flex-col justify-center">
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

      {/* submit */}
      <button
        type="button"
        onClick={next}
        disabled={!chosen}
        className="mt-6 w-full rounded-2xl bg-brand py-3.5 font-display text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        {index + 1 < total ? t.continueButton : t.finishButton}
      </button>
    </div>
  );
}
