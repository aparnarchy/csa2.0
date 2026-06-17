"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot, RecommendationCard } from "@/components/kit";
import { PILLARS } from "@/lib/pillars";
import { COPY, fill } from "@/lib/copy";
import { getSampleRecommendation, submitCheckIn, type CheckInQuestion } from "@/lib/data";
import type { SessionUser } from "@/lib/types";

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
  const meta = PILLARS[q.pillarId];
  const chosen = q.options.find((o) => o.key === selected) ?? null;
  const lowScore = chosen ? chosen.score < 7 : false;

  async function next() {
    const c = q.options.find((o) => o.key === selected);
    if (!c) return;
    await submitCheckIn(session, session.id, q.id, c.score);
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
          <Mascot state="welcome" size={128} />
          <p className="mt-2 font-display text-base font-black text-brand">
            {fill(t.greeting, { name: first })}
          </p>
          <h1 className="mt-2 font-display text-[24px] font-black leading-snug text-ink">{q.text}</h1>
          <p className="mt-2.5 text-[10px] font-bold uppercase tracking-wide text-ink-4">{meta.label}</p>
        </div>

        <div className="mt-8 space-y-3">
          {q.options.map((o) => {
            const isSel = o.key === selected;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setSelected(o.key)}
                className={`flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left text-sm font-semibold transition active:scale-[0.99] ${
                  isSel
                    ? "border-brand bg-lav-soft text-brand shadow-card"
                    : "border-transparent bg-white text-ink shadow-card"
                }`}
              >
                <span
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    isSel ? "bg-brand text-white" : "bg-lav-soft text-brand"
                  }`}
                >
                  {o.key}
                </span>
                <span className="leading-snug">{o.text}</span>
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
