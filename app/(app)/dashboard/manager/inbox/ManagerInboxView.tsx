"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, GradientHeader, Mascot, NotEnoughData, ScreenShell } from "@/components/kit";
import { HEADER_MASCOT_SIZE } from "@/lib/mascot";
import { PILLARS } from "@/lib/pillars";
import {
  getManagerInbox,
  submitManagerAction,
  MANAGER_ACTION_DELAY_WEEKS,
  type ManagerActionItem,
  type ManagerInbox,
} from "@/lib/data";
import type { SessionUser } from "@/lib/types";

type Tab = "open" | "resolved";

/** "Visible to team from <Month YYYY>", MANAGER_ACTION_DELAY_WEEKS from now. */
function visibleFromLabel(): string {
  const d = new Date();
  d.setDate(d.getDate() + MANAGER_ACTION_DELAY_WEEKS * 7);
  return `Visible to team from ${d.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
}

export function ManagerInboxView({ session, initial }: { session: SessionUser; initial: ManagerInbox }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("open");
  const [open, setOpen] = useState<ManagerActionItem[]>(initial.open);
  const [resolved, setResolved] = useState<ManagerActionItem[]>(initial.resolved);

  const isPlay = session.themeMode === "play";

  // Items the manager has acted on locally — never clobbered by polling.
  const touched = useRef<Set<string>>(new Set());

  // Poll for employee responses arriving on already-resolved actions. Pauses
  // when the tab is hidden so it doesn't run needlessly in the background.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = async () => {
      if (document.hidden) return;
      const fresh = await getManagerInbox(session, "my-team");
      setResolved((prev) =>
        prev.map((it) => {
          if (touched.current.has(it.id)) return it;
          const next = fresh.resolved.find((r) => r.id === it.id);
          return next ? { ...it, employeeResponse: next.employeeResponse } : it;
        }),
      );
    };
    timer = setInterval(tick, 12000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [session]);

  const resolvedPct =
    open.length + resolved.length === 0
      ? 100
      : Math.round((resolved.length / (open.length + resolved.length)) * 100);

  const flagged = open.filter((i) => i.status === "flagged");
  const active = open.filter((i) => i.status !== "flagged");

  function handleSubmit(item: ManagerActionItem, note: string) {
    touched.current.add(item.id);
    submitManagerAction(session, { itemId: item.id, decision: "yes", note });
    setOpen((prev) => prev.filter((i) => i.id !== item.id));
    setResolved((prev) => [
      {
        ...item,
        status: "resolved",
        actionNote: note,
        submittedAtLabel: "Submitted just now",
        visibleToEmployeesLabel: visibleFromLabel(),
        employeeResponse: { yes: 0, maybe: 0, notYet: 0 },
      },
      ...prev,
    ]);
  }

  function handleNotYet(item: ManagerActionItem) {
    touched.current.add(item.id);
    submitManagerAction(session, { itemId: item.id, decision: "not_yet" });
    setOpen((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "flagged" } : i)));
  }

  return (
    <ScreenShell active="insights">
      <button
        type="button"
        onClick={() => router.push("/dashboard/manager")}
        className="px-1 text-sm font-bold text-brand active:scale-[0.99]"
      >
        ← Team dashboard
      </button>

      {/* Header — Play: lavender card + mascot; Professional: gradient card. */}
      {isPlay ? (
        <GradientHeader
          eyebrow="✅ Action Inbox"
          title="Your team's actions"
          avatar={<Mascot state="happy" size={HEADER_MASCOT_SIZE} float={false} sparkle={false} />}
          className="flex min-h-[180px] flex-col justify-center"
        >
          <ResolvedMeter pct={resolvedPct} resolved={resolved.length} total={open.length + resolved.length} />
        </GradientHeader>
      ) : (
        <div
          className="rounded-card px-5 py-6"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <p className="text-xs font-semibold text-brand/70">✅ Action Inbox</p>
          <h1 className="mt-1 font-display text-[30px] font-black leading-tight text-brand">Your team&apos;s actions</h1>
          <div className="mt-3">
            <ResolvedMeter pct={resolvedPct} resolved={resolved.length} total={open.length + resolved.length} />
          </div>
        </div>
      )}

      {!initial.enoughReportees ? (
        <NotEnoughData message="Your team has fewer than 3 reportees, so the Action Inbox is hidden to protect everyone's anonymity." />
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1.5 rounded-2xl bg-white/70 p-1 shadow-card">
            {([
              { key: "open", label: `Open · ${open.length}` },
              { key: "resolved", label: `Resolved · ${resolved.length}` },
            ] as const).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
                  tab === t.key ? "bg-brand text-white shadow-sm" : "text-ink-4"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "open" ? (
            <>
              {active.length === 0 && flagged.length === 0 && (
                <NotEnoughData message="Nothing to act on right now. New items appear when a team pillar dips below 7." />
              )}
              {active.map((item) => (
                <OpenActionCard key={item.id} item={item} onSubmit={handleSubmit} onNotYet={handleNotYet} />
              ))}

              {flagged.length > 0 && (
                <>
                  <p className="px-1 pt-2 font-display text-sm font-black text-ink">🚩 Flagged — revisit</p>
                  {flagged.map((item) => (
                    <OpenActionCard key={item.id} item={item} onSubmit={handleSubmit} onNotYet={handleNotYet} flagged />
                  ))}
                </>
              )}
            </>
          ) : (
            <>
              {resolved.length === 0 && (
                <NotEnoughData message="No resolved actions yet. Items you act on will appear here." />
              )}
              {resolved.map((item) => (
                <ResolvedActionCard key={item.id} item={item} />
              ))}
            </>
          )}

          <p className="pb-2 text-center text-[11px] text-ink-4">
            Aggregates only. Submitted actions appear to affected teammates after {MANAGER_ACTION_DELAY_WEEKS} weeks.
          </p>
        </>
      )}
    </ScreenShell>
  );
}

function ResolvedMeter({ pct, resolved, total }: { pct: number; resolved: number; total: number }) {
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-white/50">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs font-bold text-brand">{resolved}/{total} resolved · {pct}%</p>
    </div>
  );
}

function ResponseBar({ responses }: { responses: ManagerActionItem["responses"] }) {
  const colours = ["#7C6FFF", "#C9B4FF", "#EAE8FF"];
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {responses.map((r, i) => (
          <div key={r.key} style={{ width: `${r.pct}%`, background: colours[i] }} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
        {responses.map((r, i) => (
          <span key={r.key} className="flex items-center gap-1 text-[10px] text-ink-3">
            <span className="h-2 w-2 rounded-full" style={{ background: colours[i] }} />
            {r.text} {r.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Open action — manager decides Yes (act) or Not Yet ───────────────────────
function OpenActionCard({
  item,
  onSubmit,
  onNotYet,
  flagged = false,
}: {
  item: ManagerActionItem;
  onSubmit: (item: ManagerActionItem, note: string) => void;
  onNotYet: (item: ManagerActionItem) => void;
  flagged?: boolean;
}) {
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState("");

  return (
    <Card className={flagged ? "border border-dashed border-warn/40" : ""}>
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-lav-soft px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
          {item.pillarLabel}
        </span>
        <span className="text-[11px] text-ink-4">{item.dateLabel}</span>
      </div>

      <p className="mt-2.5 font-display text-base font-black leading-snug text-ink">{item.triggerQuestion}</p>
      <p className="mt-1 text-xs text-ink-3">
        Team average <span className="font-bold text-brand">{item.teamAvg.toFixed(1)}</span> / 10
      </p>

      <div className="mt-3">
        <ResponseBar responses={item.responses} />
      </div>

      <div className="mt-4 rounded-card bg-lav-soft p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-brand">💡 {PILLARS[item.pillarId].label} tip</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{item.recommendation}</p>
      </div>

      {!composing ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="flex-1 rounded-2xl bg-brand py-3 font-display text-sm font-black text-white transition active:scale-[0.98]"
          >
            Yes, I&apos;ll act
          </button>
          {!flagged && (
            <button
              type="button"
              onClick={() => onNotYet(item)}
              className="flex-1 rounded-2xl bg-white py-3 font-display text-sm font-black text-ink-3 shadow-card transition active:scale-[0.98]"
            >
              Not yet
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What will you change? (saved privately to your journal)"
            className="w-full resize-none rounded-2xl border border-lav-mid bg-white p-3 text-sm text-ink outline-none placeholder:text-ink-4 focus:border-brand"
          />
          <p className="mt-2 text-[11px] leading-snug text-warn">
            ⏳ Once submitted, this becomes visible to affected teammates after {MANAGER_ACTION_DELAY_WEEKS} weeks — and only to those who scored low on this question.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={!note.trim()}
              onClick={() => onSubmit(item, note.trim())}
              className="flex-1 rounded-2xl bg-brand py-3 font-display text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-40"
            >
              Submit action
            </button>
            <button
              type="button"
              onClick={() => setComposing(false)}
              className="rounded-2xl bg-white px-4 py-3 font-display text-sm font-black text-ink-4 shadow-card transition active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Resolved action — read-only, with employee response + handover context ───
function ResolvedActionCard({ item }: { item: ManagerActionItem }) {
  const r = item.employeeResponse;
  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-lav-soft px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
          {item.pillarLabel}
        </span>
        <span className="text-[11px] font-bold text-good">Resolved ✓</span>
      </div>

      {item.carriedOver && (
        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-lav-soft px-2.5 py-1 text-[10px] font-semibold text-ink-3">
          🔁 {item.handledByLabel ?? "Carried over from a previous manager"}
        </p>
      )}

      <p className="mt-2.5 text-xs text-ink-3">{item.triggerQuestion}</p>
      <p className="mt-2 font-display text-[15px] font-black leading-snug text-ink">{item.actionNote}</p>

      <div className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-ink-4">
        {item.submittedAtLabel && <span>{item.submittedAtLabel}</span>}
        {item.visibleToEmployeesLabel && <span>· {item.visibleToEmployeesLabel}</span>}
      </div>

      {r && (
        <div className="mt-3 rounded-card bg-lav-soft p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-brand">How the team felt</p>
          <div className="mt-2 flex gap-4 text-xs font-semibold text-ink-2">
            <span>✅ {r.yes} helped</span>
            <span>😐 {r.maybe} unsure</span>
            <span>🚩 {r.notYet} not yet</span>
          </div>
        </div>
      )}
    </Card>
  );
}
