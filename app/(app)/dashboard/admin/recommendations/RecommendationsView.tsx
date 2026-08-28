"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { BackButton, Modal, ScreenShell } from "@/components/kit";
import { PILLARS, PILLAR_ORDER } from "@/lib/pillars";
import type { PillarId, SessionUser } from "@/lib/types";
import type { RecommendationRow } from "@/lib/admin";
import {
  clearRecommendationAction,
  upsertRecommendationAction,
} from "../actions";

export function RecommendationsView({
  session,
  initial,
}: {
  session: SessionUser;
  initial: RecommendationRow[];
}) {
  const router = useRouter();
  const isPlay = session.themeMode === "play";
  const [rows, setRows] = useState<RecommendationRow[]>(initial);
  const [editing, setEditing] = useState<{ questionId: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [pillarFilter, setPillarFilter] = useState<PillarId | "all">("all");
  const filtered = useMemo(
    () => rows.filter((r) => pillarFilter === "all" || r.pillarId === pillarFilter),
    [rows, pillarFilter],
  );
  const writtenCount = rows.filter((r) => r.text !== null).length;

  function openEdit(row: RecommendationRow) {
    setError(null);
    setEditing({ questionId: row.questionId, text: row.text ?? "" });
  }

  function save() {
    if (!editing) return;
    setError(null);
    const { questionId, text } = editing;
    startTransition(async () => {
      try {
        const next = await upsertRecommendationAction(questionId, text);
        setRows(next);
        setEditing(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save. Please try again.");
      }
    });
  }

  function clear(questionId: string) {
    if (!confirm("Revert this question to the generic placeholder recommendation?")) return;
    setError(null);
    startTransition(async () => {
      try {
        const next = await clearRecommendationAction(questionId);
        setRows(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not revert. Please try again.");
      }
    });
  }

  return (
    <ScreenShell wide noNav>
      {isPlay ? (
        <div className="rounded-card bg-lav-bg px-5 py-5">
          <BackButton label="Admin" onClick={() => router.push("/dashboard/admin")} />
          <p className="text-xs font-semibold text-brand/70">💡 Recommendations</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-ink">
            Coaching tips
          </h1>
        </div>
      ) : (
        <div
          className="rounded-card px-5 py-5"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <BackButton label="Admin" onClick={() => router.push("/dashboard/admin")} />
          <p className="text-xs font-semibold text-brand/70">💡 Recommendations</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-brand">
            Coaching tips
          </h1>
        </div>
      )}

      <div className="space-y-2">
        <select
          value={pillarFilter}
          onChange={(e) => setPillarFilter(e.target.value as PillarId | "all")}
          className="w-full rounded-xl border border-lav-mid bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
        >
          <option value="all">All pillars</option>
          {PILLAR_ORDER.map((pid) => (
            <option key={pid} value={pid}>
              {PILLARS[pid].label}
            </option>
          ))}
        </select>
        <p className="px-1 text-[11px] text-ink-4">
          {writtenCount} of {rows.length} questions have a written recommendation. The rest fall
          back to a generic pillar-level tip so nothing breaks in the app while these are filled in.
        </p>
      </div>

      {error && !editing && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>
      )}

      <div className="space-y-2.5">
        {filtered.map((r) => (
          <div key={r.questionId} className="rounded-card border border-lav-mid bg-white p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-[10px] font-black"
                  style={{ background: `${PILLARS[r.pillarId].hex}22`, color: PILLARS[r.pillarId].hex }}
                >
                  {PILLARS[r.pillarId].label}
                </span>
                <p className="mt-1.5 text-sm font-semibold leading-snug text-ink">{r.questionText}</p>
              </div>
            </div>

            {r.text ? (
              <p className="mt-2.5 rounded-xl bg-lav-soft p-3 text-[13px] leading-relaxed text-ink-2">
                {r.text}
              </p>
            ) : (
              <p className="mt-2.5 rounded-xl bg-gray-50 p-3 text-[13px] italic leading-relaxed text-ink-4">
                Not written yet — showing the generic pillar placeholder in the app.
              </p>
            )}

            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => openEdit(r)}
                className="rounded-xl bg-lav-mid px-3 py-1.5 text-[11px] font-bold text-brand active:scale-[0.98]"
              >
                {r.text ? "Edit" : "Write one"}
              </button>
              {r.text && (
                <button
                  type="button"
                  onClick={() => clear(r.questionId)}
                  disabled={pending}
                  className="rounded-xl px-3 py-1.5 text-[11px] font-bold text-ink-4 disabled:opacity-50"
                >
                  Revert to placeholder
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="pb-2 text-center text-[11px] text-ink-4">
        Changes are saved to the live database immediately and shown wherever this
        question&apos;s score is low — check-ins, Inbox, and manager/CEO breakdowns.
      </p>

      {editing && (
        <Modal
          title="Recommendation"
          onClose={() => {
            setEditing(null);
            setError(null);
          }}
        >
          <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-ink-3">
            What should someone try if they score low here?
          </label>
          <textarea
            value={editing.text}
            onChange={(e) => setEditing({ ...editing, text: e.target.value })}
            rows={4}
            className="mt-1 w-full rounded-xl border border-lav-mid bg-lav-light px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            placeholder="Try…"
          />

          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
              {error}
            </p>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setError(null);
              }}
              disabled={pending}
              className="flex-1 rounded-2xl bg-lav-mid py-3 font-display text-sm font-black text-brand active:scale-[0.98] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="flex-1 rounded-2xl bg-brand py-3 font-display text-sm font-black text-white active:scale-[0.98] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </ScreenShell>
  );
}
