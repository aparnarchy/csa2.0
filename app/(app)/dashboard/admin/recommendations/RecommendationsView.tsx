"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ADMIN_NAV, BackButton, Modal, ScreenShell } from "@/components/kit";
import { PILLARS, PILLAR_ORDER } from "@/lib/pillars";
import type { PillarId, SessionUser } from "@/lib/types";
import type { RecommendationAudience, RecommendationRow } from "@/lib/admin";
import {
  clearRecommendationAction,
  upsertRecommendationAction,
} from "../actions";

const AUDIENCE_LABEL: Record<RecommendationAudience, string> = {
  employee: "For the employee",
  manager: "For the manager",
};

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
  const [editing, setEditing] = useState<{
    questionId: string;
    audience: RecommendationAudience;
    text: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [pillarFilter, setPillarFilter] = useState<PillarId | "all">("all");
  const filtered = useMemo(
    () => rows.filter((r) => pillarFilter === "all" || r.pillarId === pillarFilter),
    [rows, pillarFilter],
  );
  const writtenCount = rows.filter((r) => r.employeeText !== null || r.managerText !== null).length;

  function openEdit(row: RecommendationRow, audience: RecommendationAudience) {
    setError(null);
    setEditing({
      questionId: row.questionId,
      audience,
      text: (audience === "employee" ? row.employeeText : row.managerText) ?? "",
    });
  }

  function save() {
    if (!editing) return;
    setError(null);
    const { questionId, audience, text } = editing;
    startTransition(async () => {
      try {
        const next = await upsertRecommendationAction(questionId, audience, text);
        setRows(next);
        setEditing(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save. Please try again.");
      }
    });
  }

  function clear(questionId: string, audience: RecommendationAudience) {
    if (!confirm(`Revert the ${audience} recommendation to the generic placeholder?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        const next = await clearRecommendationAction(questionId, audience);
        setRows(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not revert. Please try again.");
      }
    });
  }

  return (
    <ScreenShell wide active="admin" navItems={ADMIN_NAV}>
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
          {writtenCount} of {rows.length} questions have at least one written recommendation. Each
          question has a separate employee-facing and manager-facing version — the rest fall back
          to a generic pillar-level tip so nothing breaks in the app while these are filled in.
        </p>
      </div>

      {error && !editing && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>
      )}

      <div className="space-y-2.5">
        {filtered.map((r) => (
          <div key={r.questionId} className="rounded-card border border-lav-mid bg-white p-4 shadow-card">
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[10px] font-black"
              style={{ background: `${PILLARS[r.pillarId].hex}22`, color: PILLARS[r.pillarId].hex }}
            >
              {PILLARS[r.pillarId].label}
            </span>
            <p className="mt-1.5 text-sm font-semibold leading-snug text-ink">{r.questionText}</p>

            {(["employee", "manager"] as const).map((audience) => {
              const text = audience === "employee" ? r.employeeText : r.managerText;
              return (
                <div key={audience} className="mt-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-4">
                    {AUDIENCE_LABEL[audience]}
                  </p>
                  {text ? (
                    <p className="mt-1 rounded-xl bg-lav-soft p-3 text-[13px] leading-relaxed text-ink-2">
                      {text}
                    </p>
                  ) : (
                    <p className="mt-1 rounded-xl bg-gray-50 p-3 text-[13px] italic leading-relaxed text-ink-4">
                      Not written yet — showing the generic pillar placeholder in the app.
                    </p>
                  )}
                  <div className="mt-1.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(r, audience)}
                      className="rounded-xl bg-lav-mid px-3 py-1.5 text-[11px] font-bold text-brand active:scale-[0.98]"
                    >
                      {text ? "Edit" : "Write one"}
                    </button>
                    {text && (
                      <button
                        type="button"
                        onClick={() => clear(r.questionId, audience)}
                        disabled={pending}
                        className="rounded-xl px-3 py-1.5 text-[11px] font-bold text-ink-4 disabled:opacity-50"
                      >
                        Revert to placeholder
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="pb-2 text-center text-[11px] text-ink-4">
        Changes are saved to the live database immediately. Employee text shows wherever this
        question&apos;s score is low on their own check-ins, Inbox, and dashboard; manager text
        shows on the Manager Inbox and manager/CEO breakdowns.
      </p>

      {editing && (
        <Modal
          title={`${AUDIENCE_LABEL[editing.audience]} recommendation`}
          onClose={() => {
            setEditing(null);
            setError(null);
          }}
        >
          <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-ink-3">
            {editing.audience === "employee"
              ? "What should the employee try if they score low here?"
              : "What should the manager try if their team scores low here?"}
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
