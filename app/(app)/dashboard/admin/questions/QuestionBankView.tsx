"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { BackButton, Modal, ScreenShell } from "@/components/kit";
import { PILLARS, PILLAR_ORDER } from "@/lib/pillars";
import type { PillarId, Question, SessionUser } from "@/lib/types";
import type { BulkDeleteResult, CsvImportResult, QuestionInput } from "@/lib/admin";
import {
  bulkDeleteQuestionsAction,
  createQuestionAction,
  importQuestionsCsvAction,
  updateQuestionAction,
} from "../actions";

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

  // Bulk select + CSV import
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [csvSummary, setCsvSummary] = useState<CsvImportResult | null>(null);
  const [bulkSummary, setBulkSummary] = useState<BulkDeleteResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  function toggleOne(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    const filteredIds = filtered.map((q) => q.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(filteredIds));
  }

  function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} question${selected.size === 1 ? "" : "s"}?`)) return;
    setError(null);
    setBulkSummary(null);
    startTransition(async () => {
      try {
        const { result, questions: fresh } = await bulkDeleteQuestionsAction([...selected]);
        setQuestions(fresh);
        setSelected(new Set());
        setBulkSummary(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not delete. Please try again.");
      }
    });
  }

  function onPickCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = ""; // allow re-picking the same file
    if (!file) return;
    setError(null);
    setBulkSummary(null);
    startTransition(async () => {
      try {
        const text = await file.text();
        const { result, questions: fresh } = await importQuestionsCsvAction(text);
        setQuestions(fresh);
        setCsvSummary(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read that file.");
      }
    });
  }

  return (
    <ScreenShell wide noNav>
      {/* Header — mode-aware, with a back link to the admin hub. */}
      {isPlay ? (
        <div className="rounded-card bg-lav-bg px-5 py-5">
          <BackButton label="Admin" onClick={() => router.push("/dashboard/admin")} />
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
          <BackButton label="Admin" onClick={() => router.push("/dashboard/admin")} />
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
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="flex-shrink-0 rounded-full bg-lav-mid px-3.5 py-2 font-display text-xs font-black text-brand active:scale-[0.97] disabled:opacity-50"
          >
            {pending ? "Working…" : "Upload CSV"}
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPickCsv} className="hidden" />
        </div>
        <p className="px-1 text-[11px] text-ink-4">
          {filtered.length} of {questions.length} questions · CSV columns: text, pillarId, optionA_text,
          optionA_score, optionB_text, optionB_score, optionC_text, optionC_score, isActive
        </p>
      </div>

      {error && !editing && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>
      )}

      {csvSummary && (
        <div className="rounded-xl bg-lav-soft px-3 py-2 text-[11px] text-ink-2">
          <button
            type="button"
            onClick={() => setCsvSummary(null)}
            className="float-right text-ink-4"
            aria-label="Dismiss"
          >
            ✕
          </button>
          <p className="font-bold text-brand">
            CSV import: {csvSummary.created} added, {csvSummary.skipped} skipped.
          </p>
          {csvSummary.errors.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {csvSummary.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {bulkSummary && (
        <div className="rounded-xl bg-lav-soft px-3 py-2 text-[11px] text-ink-2">
          <button
            type="button"
            onClick={() => setBulkSummary(null)}
            className="float-right text-ink-4"
            aria-label="Dismiss"
          >
            ✕
          </button>
          <p className="font-bold text-brand">
            Deleted {bulkSummary.deleted}
            {bulkSummary.deactivated > 0 &&
              ` · ${bulkSummary.deactivated} already answered — deactivated instead of deleted, to keep past reports intact`}
            .
          </p>
        </div>
      )}

      {/* Bulk action bar — appears once at least one row is checked */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-ink px-3 py-2 text-white">
          <span className="text-xs font-bold">{selected.size} selected</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-white/70"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={pending}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-[11px] font-bold text-white active:scale-[0.97] disabled:opacity-50"
            >
              Delete selected
            </button>
          </div>
        </div>
      )}

      {/* Table (scrolls horizontally on narrow screens) */}
      <div className="overflow-x-auto rounded-card border border-lav-mid bg-white shadow-card">
        <table className="w-full min-w-[940px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-lav-mid text-[10px] uppercase tracking-wide text-ink-3">
              <Th className="w-8">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((q) => selected.has(q.id))}
                  onChange={toggleAllFiltered}
                  className="h-3.5 w-3.5 accent-brand"
                  aria-label="Select all"
                />
              </Th>
              <Th className="min-w-[220px]">Question</Th>
              <Th>Pillar</Th>
              <Th className="min-w-[150px]">Option A</Th>
              <Th className="text-center">Pts</Th>
              <Th className="min-w-[150px]">Option B</Th>
              <Th className="text-center">Pts</Th>
              <Th className="min-w-[150px]">Option C</Th>
              <Th className="text-center">Pts</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-[11px] text-ink-4">
                  No questions match.
                </td>
              </tr>
            )}
            {filtered.map((q) => (
              <tr
                key={q.id}
                className={`border-b border-lav-light/70 align-top last:border-0 ${
                  selected.has(q.id) ? "bg-lav-soft/60" : ""
                }`}
              >
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(q.id)}
                    onChange={() => toggleOne(q.id)}
                    className="h-3.5 w-3.5 accent-brand"
                    aria-label={`Select ${q.text}`}
                  />
                </td>
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
                <OptionCells text={q.optionA_text} score={q.optionA_score} />
                <OptionCells text={q.optionB_text} score={q.optionB_score} />
                <OptionCells text={q.optionC_text} score={q.optionC_score} />
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

/** An option's text cell plus its own dedicated score (Pts) cell. */
function OptionCells({ text, score }: { text: string; score: number }) {
  return (
    <>
      <td className="px-3 py-2.5">
        <span className="text-ink-2">{text}</span>
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className="font-display font-black text-brand">{score}</span>
      </td>
    </>
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
