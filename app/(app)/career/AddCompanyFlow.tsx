"use client";

import { useEffect, useState } from "react";
import { Mascot, MonthYearField, OptionCard } from "@/components/kit";
import { COPY, fill } from "@/lib/copy";
import type { CareerQuestion } from "@/lib/career";
import { addCareerCompanyAction, getCareerQuestionsAction } from "./actions";

const t = COPY.careerAdd;

const INPUT =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-ink placeholder-ink-4 focus:outline-none focus:ring-2 focus:ring-brand";

/** Full-screen frame shared with the weekly check-in, so both read as one flow. */
const FRAME = "mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-lav-bg px-6 pb-8 pt-5";

/** How long the tapped option stays highlighted before advancing. */
const ADVANCE_MS = 180;

type Step = "details" | "questions" | "saving" | "done";

/**
 * The career-history questionnaire: company details, then one question per
 * screen. Tapping an answer records it and moves on (Typeform style) — there is
 * no Continue button on the question screens.
 *
 * Answers are held here and written once at the end. A per-question write would
 * leave a half-finished company row that renders as a broken card if the user
 * abandons the flow.
 */
export function AddCompanyFlow({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<Step>("details");
  const [questions, setQuestions] = useState<CareerQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [details, setDetails] = useState({ name: "", role: "", startDate: "", endDate: "" });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  /** Set only for the brief highlight between tapping an option and advancing. */
  const [justPicked, setJustPicked] = useState<string | null>(null);

  useEffect(() => {
    getCareerQuestionsAction().then(setQuestions).catch(() => setError(t.loadError));
  }, []);

  function startQuestions() {
    const name = details.name.trim();
    if (!name) return setError(t.errorNameRequired);
    if (!details.startDate || !details.endDate) return setError(t.errorDatesRequired);
    if (new Date(details.endDate) <= new Date(details.startDate)) {
      return setError(t.errorEndBeforeStart);
    }
    setError(null);
    setStep("questions");
  }

  async function save(finalAnswers: Record<string, string>) {
    setStep("saving");
    try {
      await addCareerCompanyAction({ ...details, answers: finalAnswers });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : t.saveError);
      setStep("questions");
    }
  }

  function pick(questionId: string, optionKey: string) {
    if (justPicked) return; // ignore double-taps mid-transition
    const next = { ...answers, [questionId]: optionKey };
    setAnswers(next);
    setJustPicked(optionKey);

    setTimeout(() => {
      setJustPicked(null);
      if (questions && index + 1 < questions.length) setIndex(index + 1);
      else save(next);
    }, ADVANCE_MS);
  }

  function back() {
    if (index === 0) return setStep("details");
    setIndex(index - 1);
  }

  // ── Step A: company details ────────────────────────────────────────────────
  if (step === "details") {
    return (
      <div className={FRAME}>
        <button
          type="button"
          onClick={onCancel}
          className="self-start text-sm font-semibold text-ink-3 active:scale-95"
        >
          {t.backLink}
        </button>

        <div className="screen-enter flex flex-1 flex-col justify-center">
          <div className="flex flex-col items-center text-center">
            <Mascot state="welcome" size={150} float={false} />
            <h1 className="mt-3 font-display text-[24px] font-bold leading-snug text-brand">
              {t.detailsTitle}
            </h1>
            <p className="mt-2 text-sm text-ink-2">{t.detailsSubtitle}</p>
          </div>

          <div className="mt-8 space-y-3">
            <input
              className={INPUT}
              placeholder={t.companyNamePlaceholder}
              value={details.name}
              onChange={(e) => setDetails({ ...details, name: e.target.value })}
            />
            <input
              className={INPUT}
              placeholder={t.rolePlaceholder}
              value={details.role}
              onChange={(e) => setDetails({ ...details, role: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <MonthYearField
                label={t.startLabel}
                placeholder="Select"
                value={details.startDate}
                onChange={(v) => setDetails({ ...details, startDate: v })}
              />
              <MonthYearField
                label={t.endLabel}
                placeholder="Select"
                value={details.endDate}
                onChange={(v) => setDetails({ ...details, endDate: v })}
              />
            </div>
          </div>

          {error && <p className="mt-4 text-center text-sm font-semibold text-red-600">{error}</p>}
        </div>

        <button
          type="button"
          onClick={startQuestions}
          disabled={!questions}
          className="mt-6 w-full rounded-2xl bg-brand py-3.5 font-display text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          {questions ? t.startButton : t.loadingButton}
        </button>
      </div>
    );
  }

  // ── Saving ─────────────────────────────────────────────────────────────────
  if (step === "saving") {
    return (
      <div className={`${FRAME} items-center justify-center`}>
        <Mascot state="welcome" size={150} float />
        <p className="mt-4 text-sm font-semibold text-ink-2">{t.savingLabel}</p>
      </div>
    );
  }

  // ── Step C: done ───────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className={`${FRAME} items-center justify-center gap-5 text-center`}>
        <Mascot state="happy" size={150} />
        <div>
          <h1 className="font-display text-2xl font-black text-brand">{t.doneTitle}</h1>
          <p className="mt-2 text-sm text-ink-2">
            {fill(t.doneBody, { company: details.name.trim() })}
          </p>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="w-full rounded-2xl bg-brand py-3.5 font-display text-sm font-black text-white active:scale-[0.98]"
        >
          {t.doneButton}
        </button>
      </div>
    );
  }

  // ── Step B: one question per screen ────────────────────────────────────────
  if (!questions) return null;
  const q = questions[index];
  const selected = justPicked ?? answers[q.id] ?? null;

  return (
    <div className={FRAME}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          aria-label={t.backAria}
          className="text-lg font-bold text-ink-3 active:scale-95"
        >
          ←
        </button>
        <span className="text-xs font-bold text-ink-3">
          {index + 1}/{questions.length}
        </span>
      </div>

      <div key={index} className="screen-enter flex flex-1 flex-col justify-center">
        <div className="flex flex-col items-center text-center">
          <Mascot state="welcome" size={198} float={false} />
          <p className="mt-2 font-display text-base font-black text-brand">
            {fill(t.atCompany, { company: details.name.trim() })}
          </p>
          <h1 className="mt-2 font-display text-[24px] font-bold leading-snug text-brand">
            {q.text}
          </h1>
        </div>

        <div className="mt-8 space-y-3">
          {q.options.map((o) => (
            <OptionCard
              key={o.key}
              optionKey={o.key}
              text={o.text}
              selected={o.key === selected}
              onClick={() => pick(q.id, o.key)}
            />
          ))}
        </div>

        {error && <p className="mt-4 text-center text-sm font-semibold text-red-600">{error}</p>}
      </div>
    </div>
  );
}
