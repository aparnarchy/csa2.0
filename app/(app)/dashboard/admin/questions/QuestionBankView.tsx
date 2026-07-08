"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Card, Modal, ScreenShell } from "@/components/kit";
import { PILLARS, PILLAR_ORDER } from "@/lib/pillars";
import type { PillarId, Question, SessionUser } from "@/lib/types";
import type { QuestionInput } from "@/lib/admin";
import {
  createQuestionAction,
  deleteQuestionAction,
  updateQuestionAction,
} from "../actions";

const BLANK: QuestionInput = {
  text: "",
  pillarId: "meaningful_work",
  optionA_text: "Yes, definitely",
  optionA_score: 10,
  optionB_text: "Somewhat",
  optionB_score: 5,
  optionC_text: "Not really",
  optionC_score: 0,
  isActive: true,
};

export function QuestionBankView({
  session,
  initial,
}: {
  session: SessionUser;
  initial: Question[];
}) {
  const router = useRouter();
  const isPlay = session.themeMode === "play";
  const [questions, setQuestions] = useState<Question[]>(initial);
  const [editing, setEditing] = useState<{ id: string | null; input: QuestionInput } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    return PILLAR_ORDER.map((pid) => ({
      pid,
      items: questions.filter((q) => q.pillarId === pid),
    }));
  }, [questions]);

  function openNew() {
    setError(null);
    setEditing({ id: null, input: { ...BLANK } });
  }

  function openEdit(q: Question) {
    setError(null);
    const input: QuestionInput = {
      text: q.text,
      pillarId: q.pillarId,
      optionA_text: q.optionA_text,
      optionA_score: q.optionA_score,
      optionB_text: q.optionB_text,
      optionB_score: q.optionB_score,
      optionC_text: q.optionC_text,
      optionC_score: q.optionC_score,
      isActive: q.isActive,
    };
    setEditing({ id: q.id, input });
  }

  function save() {
    if (!editing) return;
    setError(null);
    const { id, input } = editing;
    startTransition(async () => {
      try {
        const next = id
          ? await updateQuestionAction(id, input)
          : await createQuestionAction(input);
        setQuestions(next);
        setEditing(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save. Please try again.");
      }
    });
  }

  function remove(q: Question) {
    if (!confirm(`Delete this question?\n\n"${q.text}"`)) return;
    setError(null);
    startTransition(async () => {
      try {
        setQuestions(await deleteQuestionAction(q.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not delete. Please try again.");
      }
    });
  }

  return (
    <ScreenShell>
      {/* Header — mode-aware, with a back link to the admin hub. */}
      {isPlay ? (
        <div className="rounded-card bg-lav-bg px-5 py-5">
          <BackBtn onClick={() => router.push("/dashboard/admin")} />
          <p className="text-xs font-semibold text-brand/70">📋 Question bank</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-ink">
            Check-in questions
          </h1>
        </div>
      ) : (
        <div
          className="rounded-card px-5 py-5"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <BackBtn onClick={() => router.push("/dashboard/admin")} />
          <p className="text-xs font-semibold text-brand/70">📋 Question bank</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-brand">
            Check-in questions
          </h1>
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-ink-3">{questions.length} questions across 4 pillars</p>
        <button
          type="button"
          onClick={openNew}
          className="rounded-full bg-brand px-3.5 py-1.5 font-display text-xs font-black text-white active:scale-[0.97]"
        >
          + Add question
        </button>
      </div>

      {error && !editing && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>
      )}

      {grouped.map(({ pid, items }) => (
        <div key={pid} className="space-y-2">
          <p className="px-1 pt-1 font-display text-sm font-black" style={{ color: PILLARS[pid].hex }}>
            {PILLARS[pid].label} · {items.length}
          </p>
          {items.length === 0 && (
            <p className="px-1 text-[11px] text-ink-4">No questions yet.</p>
          )}
          {items.map((q) => (
            <Card key={q.id}>
              <div className="flex items-start justify-between gap-2">
                <p className="flex-1 text-sm font-semibold leading-snug text-ink">{q.text}</p>
                {!q.isActive && (
                  <span className="flex-shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-ink-3">
                    Hidden
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-1">
                <OptionLine label="A" text={q.optionA_text} score={q.optionA_score} />
                <OptionLine label="B" text={q.optionB_text} score={q.optionB_score} />
                <OptionLine label="C" text={q.optionC_text} score={q.optionC_score} />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(q)}
                  className="flex-1 rounded-xl bg-lav-mid py-2 text-xs font-bold text-brand active:scale-[0.98]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(q)}
                  disabled={pending}
                  className="rounded-xl bg-red-50 px-4 py-2 text-xs font-bold text-red-600 active:scale-[0.98] disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      ))}

      <p className="pb-2 text-center text-[11px] text-ink-4">
        Changes are saved to the live database immediately.
      </p>

      {editing && (
        <Editor
          state={editing}
          setState={setEditing}
          onSave={save}
          onCancel={() => {
            setEditing(null);
            setError(null);
          }}
          pending={pending}
          error={error}
        />
      )}
    </ScreenShell>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-2 text-xs font-bold text-brand">
      ← Admin
    </button>
  );
}

function OptionLine({ label, text, score }: { label: string; text: string; score: number }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-3.5 flex-shrink-0 font-bold text-brand">{label}</span>
      <span className="flex-1 truncate text-ink-2">{text}</span>
      <span className="flex-shrink-0 font-display font-black text-brand">{score}</span>
    </div>
  );
}

/** Full-screen editor sheet for adding or editing a question. */
function Editor({
  state,
  setState,
  onSave,
  onCancel,
  pending,
  error,
}: {
  state: { id: string | null; input: QuestionInput };
  setState: (s: { id: string | null; input: QuestionInput }) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
}) {
  const { id, input } = state;
  const set = (patch: Partial<QuestionInput>) => setState({ id, input: { ...input, ...patch } });

  return (
    <Modal title={id ? "Edit question" : "New question"} onClose={onCancel}>

        <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-ink-3">
          Question text
        </label>
        <textarea
          value={input.text}
          onChange={(e) => set({ text: e.target.value })}
          rows={2}
          className="mt-1 w-full rounded-xl border border-lav-mid bg-lav-light px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          placeholder="Do you feel…?"
        />

        <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-ink-3">
          Pillar
        </label>
        <select
          value={input.pillarId}
          onChange={(e) => set({ pillarId: e.target.value as PillarId })}
          className="mt-1 w-full rounded-xl border border-lav-mid bg-lav-light px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
        >
          {PILLAR_ORDER.map((pid) => (
            <option key={pid} value={pid}>
              {PILLARS[pid].label}
            </option>
          ))}
        </select>

        <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-ink-3">
          Answer options &amp; scores (0–10)
        </p>
        {(["A", "B", "C"] as const).map((L) => {
          const tKey = `option${L}_text` as const;
          const sKey = `option${L}_score` as const;
          return (
            <div key={L} className="mt-2 flex items-center gap-2">
              <span className="w-4 flex-shrink-0 font-display font-black text-brand">{L}</span>
              <input
                value={input[tKey] as string}
                onChange={(e) => set({ [tKey]: e.target.value } as Partial<QuestionInput>)}
                className="min-w-0 flex-1 rounded-xl border border-lav-mid bg-lav-light px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                placeholder={`Option ${L}`}
              />
              <input
                type="number"
                min={0}
                max={10}
                value={input[sKey] as number}
                onChange={(e) =>
                  set({ [sKey]: Math.round(Number(e.target.value)) } as Partial<QuestionInput>)
                }
                className="w-14 flex-shrink-0 rounded-xl border border-lav-mid bg-lav-light px-2 py-2 text-center text-sm font-bold text-ink focus:border-brand focus:outline-none"
              />
            </div>
          );
        })}

        <label className="mt-4 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={input.isActive}
            onChange={(e) => set({ isActive: e.target.checked })}
            className="h-4 w-4 accent-brand"
          />
          Active (shown to employees)
        </label>

        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 rounded-2xl bg-lav-mid py-3 font-display text-sm font-black text-brand active:scale-[0.98] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="flex-1 rounded-2xl bg-brand py-3 font-display text-sm font-black text-white active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
    </Modal>
  );
}
