"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Modal, ScreenShell } from "@/components/kit";
import { PILLARS, PILLAR_ORDER } from "@/lib/pillars";
import type { PillarId, Question, SessionUser } from "@/lib/types";
import type { QuestionInput } from "@/lib/admin";
import { createQuestionAction, updateQuestionAction } from "../actions";

/** A fresh question: default scores A=4, B=10, C=7; everything editable. */
const BLANK: QuestionInput = {
  text: "",
  pillarId: "meaningful_work",
  optionA_text: "",
  optionA_score: 4,
  optionB_text: "",
  optionB_score: 10,
  optionC_text: "",
  optionC_score: 7,
  isActive: true,
};

/** Extract the editable fields from a stored question. */
function questionToInput(q: Question): QuestionInput {
  return {
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
}

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

  // Filters
  const [pillarFilter, setPillarFilter] = useState<PillarId | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter(
      (item) =>
        (pillarFilter === "all" || item.pillarId === pillarFilter) &&
        (q === "" || item.text.toLowerCase().includes(q)),
    );
  }, [questions, pillarFilter, search]);

  function openNew() {
    setError(null);
    setEditing({ id: null, input: { ...BLANK } });
  }

  function openEdit(q: Question) {
    setError(null);
    setEditing({ id: q.id, input: questionToInput(q) });
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

  /** Soft delete: flip Active/Inactive. Inactive questions leave the check-in
   *  pool but the row stays in the database. */
  function toggleStatus(q: Question) {
    setError(null);
    startTransition(async () => {
      try {
        const next = await updateQuestionAction(q.id, {
          ...questionToInput(q),
          isActive: !q.isActive,
        });
        setQuestions(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update status. Please try again.");
      }
    });
  }

  return (
    <ScreenShell wide>
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

      {/* Controls: search, pillar filter, add */}
      <div className="space-y-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search question text…"
          className="w-full rounded-xl border border-lav-mid bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <select
            value={pillarFilter}
            onChange={(e) => setPillarFilter(e.target.value as PillarId | "all")}
            className="min-w-0 flex-1 rounded-xl border border-lav-mid bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          >
            <option value="all">All pillars</option>
            {PILLAR_ORDER.map((pid) => (
              <option key={pid} value={pid}>
                {PILLARS[pid].label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={openNew}
            className="flex-shrink-0 rounded-full bg-brand px-3.5 py-2 font-display text-xs font-black text-white active:scale-[0.97]"
          >
            + Add question
          </button>
        </div>
        <p className="px-1 text-[11px] text-ink-4">
          {filtered.length} of {questions.length} questions
        </p>
      </div>

      {error && !editing && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>
      )}

      {/* Table (scrolls horizontally on narrow screens) */}
      <div className="overflow-x-auto rounded-card border border-lav-mid bg-white shadow-card">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-lav-mid text-[10px] uppercase tracking-wide text-ink-3">
              <Th className="min-w-[220px]">Question</Th>
              <Th>Pillar</Th>
              <Th className="min-w-[130px]">A</Th>
              <Th className="min-w-[130px]">B</Th>
              <Th className="min-w-[130px]">C</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[11px] text-ink-4">
                  No questions match.
                </td>
              </tr>
            )}
            {filtered.map((q) => (
              <tr key={q.id} className="border-b border-lav-light/70 align-top last:border-0">
                <td className="px-3 py-2.5">
                  <p className="font-semibold leading-snug text-ink">{q.text}</p>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black"
                    style={{ background: `${PILLARS[q.pillarId].hex}22`, color: PILLARS[q.pillarId].hex }}
                  >
                    {PILLARS[q.pillarId].label}
                  </span>
                </td>
                <OptionCell text={q.optionA_text} score={q.optionA_score} />
                <OptionCell text={q.optionB_text} score={q.optionB_score} />
                <OptionCell text={q.optionC_text} score={q.optionC_score} />
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleStatus(q)}
                    disabled={pending}
                    className="whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold disabled:opacity-50"
                    style={
                      q.isActive
                        ? { background: "#E8FBF0", color: "#059669" }
                        : { background: "#F1F0F5", color: "#8A879A" }
                    }
                    title="Toggle whether this question is in the check-in pool"
                  >
                    {q.isActive ? "● Active" : "○ Inactive"}
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => openEdit(q)}
                    className="whitespace-nowrap rounded-xl bg-lav-mid px-3 py-1.5 text-[11px] font-bold text-brand active:scale-[0.98]"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="pb-2 text-center text-[11px] text-ink-4">
        Changes are saved to the live database immediately. Inactive questions stay stored but
        leave the check-in pool.
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

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-bold ${className}`}>{children}</th>;
}

function OptionCell({ text, score }: { text: string; score: number }) {
  return (
    <td className="px-3 py-2.5">
      <div className="flex items-start gap-1.5">
        <span className="text-ink-2">{text}</span>
        <span className="flex-shrink-0 font-display font-black text-brand">{score}</span>
      </div>
    </td>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-2 text-xs font-bold text-brand">
      ← Admin
    </button>
  );
}

/** Modal editor for adding or editing a question. */
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
