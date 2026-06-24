"use client";

import { useState } from "react";
import { Card, ScreenShell } from "@/components/kit";
import {
  getSampleRecommendation,
  submitActionResponse,
  submitCheckIn,
  type ActionHistoryItem,
  type ActionResponseValue,
  type CheckInQuestion,
  type FeedbackAction,
  type LatestCheckIn,
} from "@/lib/data";
import type { SessionUser } from "@/lib/types";

const RESPONSE_META: Record<ActionResponseValue, { label: string; prompt: string | null }> = {
  yes: { label: "Yes ✅", prompt: null },
  maybe: { label: "Maybe", prompt: "What could have been better?" },
  not_yet: { label: "Not yet", prompt: "What still needs to happen?" },
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

  if (showHistory) {
    return <HistoryView history={history} onBack={() => setShowHistory(false)} />;
  }

  return (
    <ScreenShell title="Inbox" active="inbox">
      <p className="-mt-1 px-1 text-sm text-ink-3">Your latest updates and actions</p>

      {latest && <LatestCheckInCard latest={latest} />}

      <UnansweredCard questions={unanswered} session={session} />

      <FeedbackActionsCard actions={actions} session={session} />

      {history.length > 0 && (
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className="w-full py-1 text-center text-sm font-bold text-brand active:scale-[0.99]"
        >
          View past responses →
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
        📋 Latest check-in · {latest.dateLabel}
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
          <p className="text-xs font-bold text-brand">Recommendation</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{latest.recommendation}</p>
        </div>
      ) : shared ? (
        <div className="mt-3 rounded-card bg-good/10 p-3 text-center">
          <p className="text-sm font-bold text-good">Shared! 🙏</p>
        </div>
      ) : (
        <div className="mt-3">
          <p className="mb-2 text-[13px] text-ink-3">You&apos;re doing great — share what&apos;s working ✨</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What's been making work feel meaningful?"
            className="h-16 w-full resize-none rounded-xl border border-gray-300 bg-white p-3 text-sm text-ink placeholder-ink-4 focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            type="button"
            disabled={!note.trim()}
            onClick={() => setShared(true)}
            className="mt-2 w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            Share with community ✨
          </button>
        </div>
      )}
    </Card>
  );
}

// ── Unanswered questions (carousel) ──────────────────────────────────────────
function UnansweredCard({ questions, session }: { questions: CheckInQuestion[]; session: SessionUser }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { key: string; score: number }>>({});

  if (questions.length === 0) {
    return (
      <Card>
        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600">❓ Unanswered questions</p>
        <p className="mt-2 text-sm text-ink-3">All caught up — nothing waiting on you. 🎉</p>
      </Card>
    );
  }

  const q = questions[idx];
  const answeredCount = Object.keys(answers).length;
  const selected = answers[q.id];

  function pick(key: string, score: number) {
    setAnswers((a) => ({ ...a, [q.id]: { key, score } }));
    void submitCheckIn(session, session.id, q.id, score, true); // retrospective
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600">❓ Unanswered questions</p>
        <span className="text-[11px] font-bold text-brand">
          {answeredCount}/{questions.length} answered
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
            ✓ Answered
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
            <p className="text-[11px] font-bold text-brand">Recommendation</p>
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
          {idx + 1} of {questions.length}
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
          All caught up! Your answers will appear in your next analysis.
        </p>
      )}
    </Card>
  );
}

// ── Actions taken on your feedback ───────────────────────────────────────────
function FeedbackActionsCard({ actions, session }: { actions: FeedbackAction[]; session: SessionUser }) {
  return (
    <Card>
      <p className="text-[11px] font-bold uppercase tracking-wide text-good">⚡ Actions taken on your feedback</p>
      {actions.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-ink-3">
          No actions logged yet. Your manager will update this when they&apos;ve made a change based on your
          feedback.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {actions.map((a) => (
            <ActionRow key={a.id} action={a} session={session} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ActionRow({ action, session }: { action: FeedbackAction; session: SessionUser }) {
  const [response, setResponse] = useState<ActionResponseValue | null>(action.response);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  function choose(value: ActionResponseValue) {
    setResponse(value);
    setSent(false);
    if (value === "yes") {
      void submitActionResponse(session, session.id, { actionId: action.id, response: value });
    }
  }

  function send() {
    if (response && response !== "yes") {
      void submitActionResponse(session, session.id, { actionId: action.id, response, note: note.trim() || undefined });
      setSent(true);
    }
  }

  const meta = response ? RESPONSE_META[response] : null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3.5">
      <p className="text-[13px] leading-snug text-ink-2">
        You flagged <strong className="text-ink">{action.pillarLabel}</strong>. Here&apos;s what changed:
      </p>
      <div className="mt-2 rounded-xl bg-lav-soft p-3">
        <p className="text-[13px] leading-relaxed text-ink">{action.actionNote}</p>
      </div>

      <p className="mt-3 text-xs font-semibold text-ink-3">Did you see a difference?</p>
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
          <p className="text-[13px] font-bold text-good">Great to hear! Marked as resolved ✅</p>
        </div>
      )}

      {meta?.prompt && response !== "yes" && (
        <div className="mt-2.5">
          {sent ? (
            <div className="rounded-xl bg-lav-soft p-3">
              <p className="text-[11px] font-bold text-brand">
                Note sent ✓ <span className="font-normal text-ink-4">· Anonymous</span>
              </p>
              {note.trim() && <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{note}</p>}
            </div>
          ) : (
            <>
              <p className="mb-1.5 text-xs font-semibold text-ink-3">{meta.prompt}</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Share your thoughts with your manager…"
                className="h-20 w-full resize-none rounded-xl border border-gray-300 bg-white p-3 text-sm text-ink placeholder-ink-4 focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <p className="mb-2 mt-1 text-[10px] text-ink-4">🔒 Anonymous — your manager won&apos;t see your name</p>
              <button
                type="button"
                onClick={send}
                className="w-full rounded-xl bg-brand py-2.5 text-xs font-bold text-white transition active:scale-[0.98]"
              >
                Send to manager
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
        How this works {howOpen ? "▴" : "▾"}
      </button>
      {howOpen && (
        <p className="mt-1.5 rounded-xl bg-lav-light p-3 text-[11px] leading-relaxed text-ink-3">
          Your feedback feeds <strong className="text-brand">aggregated team data</strong> — your manager sees
          anonymised patterns, never individual responses. Notes are paraphrased and your name is never shown.
          Data only surfaces when a manager has <strong className="text-brand">3 or more reportees</strong>.
        </p>
      )}
    </div>
  );
}

// ── History (2.6b) — read-only ───────────────────────────────────────────────
function HistoryView({ history, onBack }: { history: ActionHistoryItem[]; onBack: () => void }) {
  return (
    <ScreenShell title="Response history" active="inbox">
      <button type="button" onClick={onBack} className="px-1 text-sm font-bold text-brand active:scale-[0.99]">
        ← Back to inbox
      </button>

      {history.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-3">No past responses yet.</p>
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
              Your response: <span className="text-brand">{RESPONSE_META[h.response].label}</span>
            </p>
            {h.note && <p className="mt-1 text-[12px] italic leading-relaxed text-ink-3">&ldquo;{h.note}&rdquo;</p>}
          </Card>
        ))
      )}
    </ScreenShell>
  );
}
