"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AIInsight,
  BackButton,
  BigScore,
  Card,
  InsightBarRow,
  PillarCard,
  ScreenShell,
  SegmentedToggle,
  SwipeToDelete,
  TrendChart,
} from "@/components/kit";
import { COPY, fill } from "@/lib/copy";
import { type CareerHistory, type CompanyDetail } from "@/lib/data";
import { deleteCareerCompanyAction, getCompanyDetailAction } from "./actions";
import { AddCompanyFlow } from "./AddCompanyFlow";

function scoreColor(score: number) {
  if (score >= 7.5) return "text-good";
  if (score >= 6) return "text-brand";
  return "text-bad";
}

export function CareerView({ history }: { history: CareerHistory }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [mode, setMode] = useState<"list" | "add">("list");
  /** The past company awaiting an "are you sure?" — null when nothing is pending. */
  const [pendingDelete, setPendingDelete] = useState<{ id: string; company: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /** The "current" company comes from employment, not the questionnaire. */
  const hasPast = history.companies.some((c) => !c.current);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCareerCompanyAction(pendingDelete.id);
      setPendingDelete(null);
      // The list comes from the server component, so re-run it rather than
      // splicing the row out here and letting the two drift apart.
      router.refresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : COPY.career.deleteError);
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (openId) getCompanyDetailAction(openId).then(setDetail);
    else setDetail(null);
  }, [openId]);

  if (openId && detail) {
    return <CompanyDetailView detail={detail} onBack={() => setOpenId(null)} />;
  }

  // The questionnaire is a focused full-screen flow — no bottom nav, like the
  // weekly check-in. router.refresh() re-runs the server page so the new company
  // is in the list by the time we return to it.
  if (mode === "add") {
    return (
      <AddCompanyFlow
        onDone={() => {
          setMode("list");
          router.refresh();
        }}
        onCancel={() => setMode("list")}
      />
    );
  }

  return (
    <ScreenShell active="profile">
      <BackButton label={COPY.career.backToProfile} onClick={() => router.push("/profile")} />

      {/* Overall career header */}
      <div
        className="rounded-card px-5 py-6"
        style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
      >
        <p className="text-xs font-semibold text-brand/70">{COPY.career.headerLabel}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-[44px] font-black leading-none text-brand">
            {history.overall.toFixed(1)}
          </span>
          <span className="text-sm text-brand/70">/10</span>
        </div>
        <p className="mt-2 text-sm font-bold text-brand-light">{fill(COPY.career.acrossSummary, { tenure: history.tenure, count: history.companies.length })}</p>
      </div>

      {/* Company list. Past companies: swipe left (or long-press) to reveal
          Delete — the current company comes from employment, so there's
          nothing to remove and it's rendered plainly, no swipe. */}
      <div className="space-y-2">
        {history.companies.map((c) => {
          const row = (
            <button
              type="button"
              onClick={() => setOpenId(c.id)}
              className="flex w-full min-w-0 items-center justify-between rounded-card bg-white p-4 text-left shadow-card transition active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-display text-base font-black text-ink">{c.company}</p>
                  {c.current && (
                    <span className="rounded-full bg-lav-soft px-2 py-0.5 text-[10px] font-bold text-brand">{COPY.career.currentChip}</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-ink-3">{c.role}</p>
                <p className="text-[11px] text-ink-4">{c.period} · {c.tenure}</p>
              </div>
              <div className="flex items-center gap-2 pl-2">
                <span className={`font-display text-xl font-black ${scoreColor(c.overallScore)}`}>
                  {c.overallScore.toFixed(1)}
                </span>
                <span className="text-xl text-ink-4">›</span>
              </div>
            </button>
          );

          if (c.current) return <div key={c.id}>{row}</div>;
          return (
            <SwipeToDelete
              key={c.id}
              deleteLabel="Delete"
              onDelete={() => setPendingDelete({ id: c.id, company: c.company })}
            >
              {row}
            </SwipeToDelete>
          );
        })}
      </div>

      {/* Questionnaire prompt — loud when there's no past company yet, quiet
          once the list has some. */}
      {hasPast ? (
        <button
          type="button"
          onClick={() => setMode("add")}
          className="w-full rounded-card border border-dashed border-lav-mid bg-white/60 p-4 text-sm font-bold text-brand transition active:scale-[0.99]"
        >
          + {COPY.career.addPromptButton}
        </button>
      ) : (
        <Card>
          <p className="font-display text-base font-black text-brand">{COPY.career.addPromptTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">{COPY.career.addPromptBody}</p>
          <button
            type="button"
            onClick={() => setMode("add")}
            className="mt-4 w-full rounded-2xl bg-brand py-3 font-display text-sm font-black text-white transition active:scale-[0.98]"
          >
            {COPY.career.addPromptButton}
          </button>
        </Card>
      )}

      {/* Confirm before removing — the answers can't be recovered, only re-entered.
          Rendered through a portal into <body>: ScreenShell's <main> runs the
          screen-enter animation, which makes it a stacking context, so an
          overlay left inside it can't rise above the bottom nav however high its
          z-index goes. Escaping to the body is what puts it over the nav. */}
      {pendingDelete && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-4 pb-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card bg-white p-5 shadow-card">
            <p className="font-display text-lg font-black text-ink">
              {fill(COPY.career.deleteConfirmTitle, { company: pendingDelete.company })}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-3">
              {COPY.career.deleteConfirmBody}
            </p>

            {deleteError && (
              <p className="mt-3 text-sm font-semibold text-red-600">{deleteError}</p>
            )}

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPendingDelete(null);
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="flex-1 rounded-2xl bg-lav-soft py-3 font-display text-sm font-black text-brand transition active:scale-[0.98] disabled:opacity-40"
              >
                {COPY.career.deleteCancelButton}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 rounded-2xl bg-red-600 py-3 font-display text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-40"
              >
                {COPY.career.deleteConfirmButton}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </ScreenShell>
  );
}

// ── Company detail (2.8b) ────────────────────────────────────────────────────
/**
 * One company, on the SAME dashboard design as the employee insights screen —
 * gradient header, bright spot / watch out, big score + the 4-across pillar row,
 * the strengths/concerns accordion, trend chart last.
 *
 * How much of it renders depends on where the data came from. The current
 * company aggregates real weekly check-ins, so every block appears. A past
 * company is one pass of the career questionnaire: no deltas, no percentiles,
 * no response breakdowns and no series, so those blocks are omitted rather than
 * drawn empty.
 */
function CompanyDetailView({ detail, onBack }: { detail: CompanyDetail; onBack: () => void }) {
  const [tab, setTab] = useState<"strengths" | "concerns">("strengths");
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = tab === "strengths" ? detail.strengths : detail.concerns;

  const up = (detail.delta ?? 0) >= 0;

  return (
    <ScreenShell active="profile">
      <BackButton label={COPY.career.backToCareer} onClick={onBack} />

      {/* Header — same lavender gradient card as the insights dashboard, with the
          company standing in for the greeting. */}
      <div
        className="rounded-card px-5 py-6"
        style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
      >
        <p className="text-xs font-semibold text-brand/70">{detail.role}</p>
        <h1 className="mt-1 font-display text-[34px] font-black leading-tight text-brand">
          {detail.company}
        </h1>
        <p className="mt-1 text-[11px] text-brand/70">{detail.period}</p>
        <span className="mt-3 inline-block rounded-full bg-white/50 px-3 py-1 text-[11px] font-semibold text-brand">
          {detail.current ? COPY.career.liveDataChip : fill(COPY.career.snapshotChip, { date: detail.frozenAt ?? "" })}
        </span>
      </div>

      {/* Big score + the single-row pillar grid — identical to the dashboard. */}
      <Card>
        <div className="mb-4">
          <BigScore
            score={detail.overallScore}
            caption={COPY.career.scoreCaption}
            trailing={
              detail.delta !== null ? (
                <div
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
                  style={{ background: up ? "#E8FBF0" : "#FDECEC", color: up ? "#059669" : "#DC2626" }}
                >
                  {up ? "↑" : "↓"} {Math.abs(detail.delta).toFixed(1)}
                  <span className="text-[10px] font-medium text-ink-3">{COPY.career.vsLast}</span>
                </div>
              ) : undefined
            }
          />
        </div>

        <div className="-mx-1.5 grid grid-cols-4 gap-2">
          {detail.pillars.map((p) => (
            <PillarCard key={p.pillarId} data={p} />
          ))}
        </div>
      </Card>

      {/* ✨ How this company compares with the rest of their career. */}
      <AIInsight text={detail.insight ?? undefined} />

      {/* Strengths / concerns — the dashboard's accordion. Questionnaire rows
          have no breakdown, so InsightBarRow renders them as static bars. */}
      {rows.length > 0 && (
        <Card>
          <p className="mb-3 text-sm font-bold text-brand">{COPY.career.insightsTitle}</p>
          <div className="mb-4">
            <SegmentedToggle
              value={tab}
              onChange={(v) => {
                setTab(v);
                setOpenId(null);
              }}
              options={[
                { value: "strengths", label: COPY.career.strengthsTab },
                { value: "concerns", label: COPY.career.concernsTab },
              ]}
            />
          </div>
          {rows.map((q) => (
            <InsightBarRow
              key={q.id}
              q={q}
              isStrength={tab === "strengths"}
              open={openId === q.id}
              onToggle={() => setOpenId((cur) => (cur === q.id ? null : q.id))}
            />
          ))}
        </Card>
      )}

      {/* Trend last, as on every dashboard — current company only. */}
      {detail.trend.length > 0 && <TrendChart data={detail.trend} />}

      <p className="pb-2 text-center text-[11px] text-ink-4">
        {detail.current
          ? COPY.career.liveFootnote
          : `${fill(COPY.career.frozenFootnote, { date: detail.frozenAt ?? "" })} · ${COPY.career.questionnaireNote}`}
      </p>
    </ScreenShell>
  );
}
