"use client";

import { useState } from "react";
import { Card, GradientHeader, Mascot, ScreenShell } from "@/components/kit";
import { HEADER_MASCOT_SIZE } from "@/lib/mascot";
import {
  getSampleRecommendation,
  type ActionHistoryItem,
  type ActionResponseValue,
  type CheckInQuestion,
  type FeedbackAction,
  type LatestCheckIn,
} from "@/lib/data";
import type { SessionUser } from "@/lib/types";
import { COPY, fill } from "@/lib/copy";
import { submitCheckInAction } from "../check-in/actions";
import { submitActionResponseAction } from "./actions";

const RESPONSE_META: Record<ActionResponseValue, { label: string; prompt: string | null }> = {
  yes: { label: COPY.inbox.responseYes, prompt: null },
  maybe: { label: COPY.inbox.responseMaybe, prompt: COPY.inbox.maybePrompt },
  not_yet: { label: COPY.inbox.responseNotYet, prompt: COPY.inbox.notYetPrompt },
};

export function InboxView({
  session,
  latest,
  unanswered,
  actions,
  history,
}: {
  session: SessionUser;
  latest: LatestCheckIn | null;
  unanswered: CheckInQuestion[];
  actions: FeedbackAction[];
  history: ActionHistoryItem[];
}) {
  const [showHistory, setShowHistory] = useState(false);
  const isPlay = session.themeMode === "play";
  const firstName = (session.name || "there").trim().split(/\s+/)[0];

  if (showHistory) {
    return <HistoryView history={history} onBack={() => setShowHistory(false)} />;
  }

  return (
    <ScreenShell active="inbox">
      {/* Header — matches the dashboard. Play: lavender card + mascot;
          Professional: a smaller richer-gradient card, no mascot. */}
      {isPlay ? (
        <GradientHeader
          eyebrow={COPY.inbox.eyebrow}
          title={fill(COPY.inbox.greeting, { name: firstName })}
          avatar={<Mascot state="welcome" size={HEADER_MASCOT_SIZE} float={false} sparkle={false} />}
          className="flex min-h-[180px] flex-col justify-center"
        >
          <p className="mt-2 text-sm font-bold leading-snug text-brand">
            {COPY.inbox.tagline}
          </p>
        </GradientHeader>
      ) : (
        <div
          className="rounded-card px-5 py-6"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <p className="text-xs font-semibold text-brand/70">{COPY.inbox.eyebrow}</p>
          <h1 className="mt-1 font-display text-[34px] font-black leading-tight text-brand">
            {fill(COPY.inbox.greeting, { name: firstName })}
          </h1>
          <p className="mt-2 font-display text-base font-black leading-snug text-brand-light">
            {COPY.inbox.tagline}
          </p>
        </div>
      )}

      {latest && <LatestCheckInCard latest={latest} />}

      <UnansweredCard questions={unanswered} />

      <FeedbackActionsCard actions={actions} />

      {history.length > 0 && (
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className="w-full py-1 text-center text-sm font-bold text-brand active:scale-[0.99]"
        >
          {COPY.inbox.viewPastResponses}
        </button>
      )}
    </ScreenShell>
  );
}

// ── Latest check-in ──────────────────────────────────────────────────────────
function LatestCheckInCard({ latest }: { latest: LatestCheckIn }) {
  const [shared, setShared] = useState(false);
  const [note, setNote] = useState("");

  return (
    <Card>
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand">
        {fill(COPY.inbox.latestCheckInLabel, { date: latest.dateLabel })}
      </p>
      <p className="mt-2 text-sm font-semibold leading-snug text-ink">&ldquo;{latest.questionText}&rdquo;</p>
      <p className="mt-2 flex items-baseline gap-1">
        <span className={`font-display text-3xl font-black ${latest.isLow ? "text-bad" : "text-brand"}`}>
          {latest.score}
        </span>
        <span className="text-sm text-ink-4">/10</span>
      </p>

      {latest.isLow && latest.recommendation ? (
        <div className="mt-3 rounded-card bg-lav-soft p-3.5">
          <p className="text-xs font-bold text-brand">{COPY.inbox.recommendationLabel}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{latest.recommendation}</p>
        </div>
      ) : shared ? (
        <div className="mt-3 rounded-card bg-good/10 p-3 text-center">
          <p className="text-sm font-bold text-good">{COPY.inbox.sharedThanks}</p>
        </div>
      ) : (
        <div className="mt-3">
          <p className="mb-2 text-[13px] text-ink-3">{COPY.inbox.doingGreatPrompt}</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={COPY.inbox.shareNotePlaceholder}
            className="h-16 w-full resize-none rounded-xl border border-gray-300 bg-white p-3 text-sm text-ink placeholder-ink-4 focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            type="button"
            disabled={!note.trim()}
            onClick={() => setShared(true)}
            className="mt-2 w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            {COPY.inbox.shareButton}
          </button>
        </div>
      )}
    </Card>
  );
}

// ── Unanswered questions (carousel) ──────────────────────────────────────────
function UnansweredCard({ questions }: { questions: CheckInQuestion[] }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { key: string; score: number }>>({});

  if (questions.length === 0) {
    return (
      <Card>
        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600">{COPY.inbox.unansweredLabel}</p>
        <p className="mt-2 text-sm text-ink-3">{COPY.inbox.allCaughtUpEmpty}</p>
      </Card>
    );
  }

  const q = questions[idx];
  const answeredCount = Object.keys(answers).length;
  const selected = answers[q.id];

  function pick(key: string, score: number) {
    setAnswers((a) => ({ ...a, [q.id]: { key, score } }));
    void submitCheckInAction(q.id, score, true); // retrospective
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600">{COPY.inbox.unansweredLabel}</p>
        <span className="text-[11px] font-bold text-brand">
          {fill(COPY.inbox.answeredCount, { answered: answeredCount, total: questions.length })}
        </span>
      </div>

      {/* dots */}
      <div className="mt-3 flex justify-center gap-1.5">
        {questions.map((uq, i) => (
          <span
            key={uq.id}
            className={`h-2 rounded-full transition-all ${
              answers[uq.id] ? "w-2 bg-good" : i === idx ? "w-5 bg-brand" : "w-2 bg-lav-mid"
            }`}
          />
        ))}
      </div>

      <div
        className={`mt-3 rounded-2xl border p-3.5 transition ${
          selected ? "border-good bg-good/5" : "border-gray-200 bg-white"
        }`}
      >
        {q.weekLabel && <p className="mb-1 text-[11px] font-semibold text-ink-4">{q.weekLabel}</p>}
        {selected && (
          <span className="mb-2 inline-block rounded-md bg-good/15 px-2 py-0.5 text-[10px] font-bold text-good">
            {COPY.inbox.answeredChip}
          </span>
        )}
        <p className="mb-3 text-sm font-bold leading-snug text-ink">{q.text}</p>

        <div className="flex flex-col gap-2">
          {q.options.map((opt) => {
            const picked = selected?.key === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => pick(opt.key, opt.score)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition active:scale-[0.99] ${
                  picked ? "border-good bg-good/10" : "border-gray-200 bg-white"
                }`}
              >
                <span
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                    picked ? "bg-good text-white" : "bg-lav-soft text-brand"
                  }`}
                >
                  {opt.key}
                </span>
                <span className="text-[13px] leading-snug text-ink">{opt.text}</span>
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
      </div>

      {/* nav */}
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          disabled={idx === 0}
          onClick={() => setIdx((i) => i - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-lav-soft text-brand disabled:opacity-30"
        >
          ←
        </button>
        <span className="text-xs font-semibold text-ink-3">
          {fill(COPY.inbox.questionProgress, { current: idx + 1, total: questions.length })}
        </span>
        <button
          type="button"
          disabled={idx === questions.length - 1}
          onClick={() => setIdx((i) => i + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-lav-soft text-brand disabled:opacity-30"
        >
          →
        </button>
      </div>

      {answeredCount === questions.length && (
        <p className="mt-3 text-center text-xs font-semibold text-good">
          {COPY.inbox.allAnsweredNote}
        </p>
      )}
    </Card>
  );
}

// ── Actions taken on your feedback ───────────────────────────────────────────
function FeedbackActionsCard({ actions }: { actions: FeedbackAction[] }) {
  return (
    <Card>
      <p className="text-[11px] font-bold uppercase tracking-wide text-good">{COPY.inbox.actionsLabel}</p>
      {actions.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-ink-3">
          {COPY.inbox.noActionsBody}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {actions.map((a) => (
            <ActionRow key={a.id} action={a} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ActionRow({ action }: { action: FeedbackAction }) {
  const [response, setResponse] = useState<ActionResponseValue | null>(action.response);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  function choose(value: ActionResponseValue) {
    setResponse(value);
    setSent(false);
    if (value === "yes") {
      void submitActionResponseAction(action.id, value);
    }
  }

  function send() {
    if (response && response !== "yes") {
      void submitActionResponseAction(action.id, response, note.trim() || undefined);
      setSent(true);
    }
  }

  const meta = response ? RESPONSE_META[response] : null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3.5">
      <p className="text-[13px] leading-snug text-ink-2">
        {COPY.inbox.flaggedIntroBefore} <strong className="text-ink">{action.pillarLabel}</strong>
        {COPY.inbox.flaggedIntroAfter}
      </p>
      <div className="mt-2 rounded-xl bg-lav-soft p-3">
        <p className="text-[13px] leading-relaxed text-ink">{action.actionNote}</p>
      </div>

      <p className="mt-3 text-xs font-semibold text-ink-3">{COPY.inbox.didYouSeeDifference}</p>
      <div className="mt-2 flex gap-1.5 rounded-xl bg-lav-soft p-1">
        {(Object.keys(RESPONSE_META) as ActionResponseValue[]).map((key) => {
          const active = response === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => choose(key)}
              className={`flex-1 rounded-lg py-2 text-[11px] font-bold transition ${
                active ? "bg-white text-brand shadow-card" : "text-ink-4"
              }`}
            >
              {RESPONSE_META[key].label}
            </button>
          );
        })}
      </div>

      {response === "yes" && (
        <div className="mt-2 rounded-xl bg-good/10 p-2.5 text-center">
          <p className="text-[13px] font-bold text-good">{COPY.inbox.resolvedGreat}</p>
        </div>
      )}

      {meta?.prompt && response !== "yes" && (
        <div className="mt-2.5">
          {sent ? (
            <div className="rounded-xl bg-lav-soft p-3">
              <p className="text-[11px] font-bold text-brand">
                {COPY.inbox.noteSent} <span className="font-normal text-ink-4">{COPY.inbox.noteAnonymous}</span>
              </p>
              {note.trim() && <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{note}</p>}
            </div>
          ) : (
            <>
              <p className="mb-1.5 text-xs font-semibold text-ink-3">{meta.prompt}</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={COPY.inbox.notePlaceholder}
                className="h-20 w-full resize-none rounded-xl border border-gray-300 bg-white p-3 text-sm text-ink placeholder-ink-4 focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <p className="mb-2 mt-1 text-[10px] text-ink-4">{COPY.inbox.anonNote}</p>
              <button
                type="button"
                onClick={send}
                className="w-full rounded-xl bg-brand py-2.5 text-xs font-bold text-white transition active:scale-[0.98]"
              >
                {COPY.inbox.sendToManager}
              </button>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setHowOpen((o) => !o)}
        className="mt-2 block text-[11px] text-ink-4"
      >
        {COPY.inbox.howThisWorks} {howOpen ? "▴" : "▾"}
      </button>
      {howOpen && (
        <p className="mt-1.5 rounded-xl bg-lav-light p-3 text-[11px] leading-relaxed text-ink-3">
          {COPY.inbox.howItWorksBody}
        </p>
      )}
    </div>
  );
}

// ── History (2.6b) — read-only ───────────────────────────────────────────────
function HistoryView({ history, onBack }: { history: ActionHistoryItem[]; onBack: () => void }) {
  return (
    <ScreenShell title={COPY.inbox.historyTitle} active="inbox">
      <button type="button" onClick={onBack} className="px-1 text-sm font-bold text-brand active:scale-[0.99]">
        {COPY.inbox.backToInbox}
      </button>

      {history.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-3">{COPY.inbox.noPastResponses}</p>
        </Card>
      ) : (
        history.map((h) => (
          <Card key={h.id}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-brand">{h.pillarLabel}</p>
              <span className="text-[11px] text-ink-4">{h.respondedAtLabel}</span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{h.actionNote}</p>
            <p className="mt-2 text-xs font-bold text-ink">
              {COPY.inbox.yourResponse} <span className="text-brand">{RESPONSE_META[h.response].label}</span>
            </p>
            {h.note && <p className="mt-1 text-[12px] italic leading-relaxed text-ink-3">&ldquo;{h.note}&rdquo;</p>}
          </Card>
        ))
      )}
    </ScreenShell>
  );
}
