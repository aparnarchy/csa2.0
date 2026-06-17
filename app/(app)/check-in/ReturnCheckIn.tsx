"use client";

import { useState } from "react";
import { Mascot } from "@/components/kit";
import { PILLARS } from "@/lib/pillars";
import { submitFollowUp, type OpenRecommendation } from "@/lib/data";
import type { SessionUser } from "@/lib/types";

/**
 * Return check-in (Phase 2.3). Shown only when an unacted low-score
 * recommendation exists. Recalls the recommendation and asks whether the user
 * acted on it: "Yes" opens a short journal (saved + followUpStatus="acted");
 * "Not yet" shows gentle encouragement (followUpStatus="not_acted"). There is
 * no high-score path. When finished it calls onDone() to continue the session.
 */
export function ReturnCheckIn({
  session,
  rec,
  onDone,
}: {
  session: SessionUser;
  rec: OpenRecommendation;
  onDone: () => void;
}) {
  const [answer, setAnswer] = useState<"yes" | "not_yet" | null>(null);
  const [note, setNote] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [saving, setSaving] = useState(false);

  const meta = PILLARS[rec.pillarId];

  async function saveActed() {
    setSaving(true);
    await submitFollowUp(session, session.id, {
      questionId: rec.questionId,
      pillarId: rec.pillarId,
      status: "acted",
      journalText: note.trim() || undefined,
    });
    setSaving(false);
    setCelebrate(true);
  }

  async function saveNotActed() {
    setSaving(true);
    await submitFollowUp(session, session.id, {
      questionId: rec.questionId,
      pillarId: rec.pillarId,
      status: "not_acted",
    });
    setSaving(false);
    onDone();
  }

  // ── Confirmation after "Yes" ──────────────────────────────────────────────
  if (celebrate) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center gap-5 bg-lav-bg px-8 text-center">
        <Mascot state="happy" size={150} />
        <div>
          <h1 className="font-display text-2xl font-black text-brand">Love that! 🎉</h1>
          <p className="mt-2 text-sm text-ink-2">
            Acting on small things is exactly how your score moves. That&apos;s saved to your journal.
          </p>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="w-full rounded-2xl bg-brand py-3.5 font-display text-sm font-black text-white active:scale-[0.98]"
        >
          Continue →
        </button>
      </div>
    );
  }

  // ── The follow-up question ────────────────────────────────────────────────
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-lav-bg px-5 pb-8 pt-6">
      <div className="flex items-start justify-between">
        <div className="pt-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand">Welcome back</p>
          <h1 className="mt-1 font-display text-[26px] font-black leading-tight text-ink">
            Following up on your last nudge
          </h1>
        </div>
        <Mascot state="sad" size={96} />
      </div>

      {/* recall the recommendation */}
      <div className="mt-6 rounded-card bg-lav-soft p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand">
            {meta.label}
          </span>
          <span className="text-[11px] text-ink-3">{rec.weekLabel}</span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-3">
          Your score here was a little lower than your recent average, so we suggested:
        </p>
        <p className="mt-2 text-sm font-semibold italic leading-relaxed text-ink">
          &ldquo;{rec.recommendation}&rdquo;
        </p>
      </div>

      {/* the prompt */}
      <p className="mt-7 font-display text-lg font-black text-ink">
        Were you able to act on it?
      </p>

      <div className="mt-4 flex gap-3">
        {[
          { key: "yes", label: "Yes ✓" },
          { key: "not_yet", label: "Not yet" },
        ].map((o) => {
          const sel = answer === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => setAnswer(o.key as "yes" | "not_yet")}
              className={`flex-1 rounded-2xl border py-4 text-center text-sm font-bold transition active:scale-[0.98] ${
                sel
                  ? "border-brand bg-brand text-white shadow-card"
                  : "border-transparent bg-white text-ink-2 shadow-card"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {/* Yes → journal */}
      {answer === "yes" && (
        <div className="screen-enter mt-6">
          <label className="text-sm font-semibold text-ink-2">What did you do?</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Asked my manager for a stretch project in our 1:1…"
            className="mt-2 h-24 w-full resize-none rounded-2xl border border-gray-300 bg-white p-3.5 text-sm text-ink placeholder-ink-4 focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      )}

      {/* Not yet → gentle encouragement */}
      {answer === "not_yet" && (
        <div className="screen-enter mt-6 flex items-start gap-3 rounded-card bg-lav-soft p-4">
          <span className="text-xl leading-tight" aria-hidden>🍃</span>
          <p className="text-sm leading-relaxed text-brand">
            No worries — life gets busy. Keep it in mind this week; even one small step counts.
          </p>
        </div>
      )}

      {/* primary action */}
      <button
        type="button"
        onClick={answer === "yes" ? saveActed : saveNotActed}
        disabled={!answer || saving}
        className="mt-auto w-full rounded-2xl bg-brand py-3.5 font-display text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        {answer === "not_yet" ? "Okay, got it" : "Save"}
      </button>
    </div>
  );
}
