"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, ScreenShell } from "@/components/kit";
import { getCompanyDetail, type CareerHistory, type CompanyDetail } from "@/lib/data";
import type { SessionUser } from "@/lib/types";

function scoreColor(score: number) {
  if (score >= 7.5) return "text-good";
  if (score >= 6) return "text-brand";
  return "text-bad";
}

export function CareerView({ session, history }: { session: SessionUser; history: CareerHistory }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompanyDetail | null>(null);

  useEffect(() => {
    if (openId) getCompanyDetail(session, session.id, openId).then(setDetail);
    else setDetail(null);
  }, [openId, session]);

  if (openId && detail) {
    return <CompanyDetailView detail={detail} onBack={() => setOpenId(null)} />;
  }

  return (
    <ScreenShell active="profile">
      <button
        type="button"
        onClick={() => router.push("/profile")}
        className="px-1 text-sm font-bold text-brand active:scale-[0.99]"
      >
        ← Profile
      </button>

      {/* Overall career header */}
      <div
        className="rounded-card px-5 py-6"
        style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
      >
        <p className="text-xs font-semibold text-brand/70">Career happiness</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-[44px] font-black leading-none text-brand">
            {history.overall.toFixed(1)}
          </span>
          <span className="text-sm text-brand/70">/10</span>
        </div>
        <p className="mt-2 text-sm font-bold text-brand-light">Across {history.tenure} and {history.companies.length} companies.</p>
      </div>

      {/* Company list */}
      <div className="space-y-2">
        {history.companies.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setOpenId(c.id)}
            className="flex w-full items-center justify-between rounded-card bg-white p-4 text-left shadow-card transition active:scale-[0.99]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-display text-base font-black text-ink">{c.company}</p>
                {c.current && (
                  <span className="rounded-full bg-lav-soft px-2 py-0.5 text-[10px] font-bold text-brand">Current</span>
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
        ))}
      </div>
    </ScreenShell>
  );
}

// ── Company detail (2.8b) — frozen snapshot, read-only ───────────────────────
function CompanyDetailView({ detail, onBack }: { detail: CompanyDetail; onBack: () => void }) {
  const [tab, setTab] = useState<"strengths" | "concerns">("concerns");
  const rows = tab === "strengths" ? detail.strengths : detail.concerns;

  return (
    <ScreenShell active="profile">
      <button type="button" onClick={onBack} className="px-1 text-sm font-bold text-brand active:scale-[0.99]">
        ← Career history
      </button>

      {/* Header */}
      <div className="rounded-card px-5 py-6" style={{ background: "linear-gradient(135deg, #7C6FFF 0%, #9B8FFF 100%)" }}>
        <p className="text-xs text-white/70">{detail.role}</p>
        <div className="mt-1 flex items-end justify-between">
          <h1 className="font-display text-2xl font-black leading-tight text-white">{detail.company}</h1>
          <span className="font-display text-[44px] font-black leading-none text-white">{detail.overallScore.toFixed(1)}</span>
        </div>
        <p className="mt-1 text-[11px] text-white/70">{detail.period}</p>
        <span className="mt-3 inline-block rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold text-white">
          {detail.current ? "📍 Live data" : `🔒 Snapshot · ${detail.frozenAt}`}
        </span>
      </div>

      {/* Pillar 2×2 */}
      <Card>
        <p className="mb-3 text-sm font-bold text-brand">Pillars</p>
        <div className="grid grid-cols-2 gap-2">
          {detail.pillars.map((p) => (
            <div key={p.pillarId} className="rounded-card bg-lav-soft p-3">
              <p className="text-[11px] font-semibold text-ink-3">{p.label}</p>
              <p className={`mt-1 font-display text-2xl font-black leading-none ${scoreColor(p.score)}`}>
                {p.score.toFixed(1)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Strengths / concerns */}
      <Card>
        <p className="mb-3 text-sm font-bold text-brand">Insights</p>
        <div className="mb-4 flex gap-1.5 rounded-xl bg-lav-soft p-1">
          {([
            { key: "strengths", label: "💪 Strengths" },
            { key: "concerns", label: "⚠️ Concerns" },
          ] as const).map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setTab(o.key)}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                tab === o.key ? "bg-white text-brand shadow-card" : "text-ink-4"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {rows.map((q) => (
            <div key={q.text}>
              <div className="mb-1 flex items-start justify-between gap-3">
                <p className="text-[13px] leading-snug text-ink">{q.text}</p>
                <span className={`font-display text-base font-black ${scoreColor(q.score)}`}>{q.score.toFixed(1)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-lav-soft">
                <div className="h-full rounded-full bg-brand" style={{ width: `${q.score * 10}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <p className="pb-2 text-center text-[11px] text-ink-4">
        {detail.current ? "Live data from your current company." : `Frozen snapshot · ${detail.frozenAt} · read-only`}
      </p>
    </ScreenShell>
  );
}
