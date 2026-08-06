"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BigScore, Card, CustomDropdown, GradientHeader, Mascot, NotEnoughData, CEO_NAV, ScreenShell } from "@/components/kit";
import { type CeoDashboard, type Window } from "@/lib/data";
import { getCeoDashboardAction, getDepartmentScoresAction } from "./actions";
import type { DepartmentScore } from "@/lib/ceo";
import { HEADER_MASCOT_SIZE, mascotForScore } from "@/lib/mascot";
import type { SessionUser } from "@/lib/types";

const BAND_COLOR: Record<"green" | "amber" | "red", string> = {
  green: "#059669",
  amber: "#b45309",
  red: "#dc2626",
};

const TIME_OPTS: [string, string][] = [
  ["1M", "1 Month"], ["3M", "3 Months"], ["6M", "6 Months"], ["1Y", "1 Year"], ["All", "All time"],
];

/**
 * Org dashboard (the CEO/HR "Dashboard" tab): overall company happiness score,
 * then one panel per department — tap through to that department's head view
 * (DeptDetailView, reached via /dashboard/ceo-hr/dept/[deptId]).
 */
export function OrgDashboardView({
  session,
  initialOrg,
  initialDepts,
}: {
  session: SessionUser;
  initialOrg: CeoDashboard;
  initialDepts: DepartmentScore[];
}) {
  const router = useRouter();
  const [window, setWindow] = useState<Window>("3M");
  const [org, setOrg] = useState<CeoDashboard>(initialOrg);
  const [depts, setDepts] = useState<DepartmentScore[]>(initialDepts);

  useEffect(() => {
    getCeoDashboardAction("org", window).then(setOrg);
    getDepartmentScoresAction(window).then(setDepts);
  }, [window]);

  const isPlay = session.themeMode === "play";
  const firstName = (session.name || "there").trim().split(/\s+/)[0];

  return (
    <ScreenShell active="dashboard" navItems={CEO_NAV}>
      {isPlay ? (
        <GradientHeader
          eyebrow="🏢 Org dashboard"
          title={`Hi ${firstName}`}
          avatar={
            <Mascot
              state={mascotForScore(org.score, org.enoughData)}
              size={HEADER_MASCOT_SIZE}
              float={false}
              sparkle={false}
            />
          }
          className="flex min-h-[180px] flex-col justify-center"
        >
          <p className="mt-2 text-sm font-bold text-brand">Company-wide aggregates — never an individual.</p>
        </GradientHeader>
      ) : (
        <div
          className="rounded-card px-5 py-6"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <p className="text-xs font-semibold text-brand/70">🏢 Org dashboard</p>
          <h1 className="mt-1 font-display text-[30px] font-black leading-tight text-brand">Hi {firstName}</h1>
          <p className="mt-2 font-display text-base font-black leading-snug text-brand-light">
            Company-wide aggregates — never an individual.
          </p>
        </div>
      )}

      {/* Overall company happiness score */}
      <Card>
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 text-[11px] font-medium uppercase tracking-wider text-brand">
            Overall happiness
          </p>
          <CustomDropdown value={window} onChange={(v) => setWindow(v as Window)} options={TIME_OPTS} align="right" />
        </div>
        {!org.enoughData || org.score === null ? (
          <p className="mt-2 text-xs text-ink-3">{org.reason}</p>
        ) : (
          <>
            <BigScore score={org.score} />
            <p className="mt-1 text-xs text-ink-3">
              {org.peopleCount} people · {org.percentile}th percentile
            </p>
          </>
        )}
      </Card>

      {/* Department panels */}
      <p className="px-1 pt-1 font-display text-sm font-black text-ink">Departments</p>
      <div className="space-y-2.5">
        {depts.map((d) => (
          <DeptPanel key={d.deptId} dept={d} onOpen={() => router.push(`/dashboard/ceo-hr/dept/${d.deptId}`)} />
        ))}
        {depts.length === 0 && <NotEnoughData message="No departments set up yet." />}
      </div>

      <p className="pb-2 text-center text-[11px] text-ink-4">
        Ranked by score. Tap a department to see its full dashboard.
      </p>
    </ScreenShell>
  );
}

function DeptPanel({ dept, onOpen }: { dept: DepartmentScore; onOpen: () => void }) {
  if (!dept.enoughData || dept.score === null) {
    return (
      <div className="flex items-center gap-3 rounded-card border border-gray-200 bg-gray-50 p-4 opacity-70">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-lg">
          🔒
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-black text-ink-2">{dept.name}</p>
          <p className="text-[11px] text-ink-4">Below the anonymity floor — no score shown</p>
        </div>
      </div>
    );
  }

  const color = dept.band ? BAND_COLOR[dept.band] : "#8B82F6";
  const up = (dept.delta ?? 0) >= 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full overflow-hidden rounded-card border border-lav-light bg-white text-left shadow-card transition active:scale-[0.99]"
    >
      <div className="flex items-center gap-3 p-4">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl font-display text-base font-black"
          style={{ background: "#F2F0FF", color }}
        >
          {dept.score.toFixed(1)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-black text-ink">{dept.name}</p>
          {dept.delta !== null && (
            <p className="mt-0.5 text-[11px] text-ink-3">
              {up ? "↑" : "↓"} {Math.abs(dept.delta).toFixed(1)} vs last
            </p>
          )}
        </div>
        <span className="flex-shrink-0 text-brand-light">→</span>
      </div>
      <div className="h-1 w-full bg-lav-soft">
        <div className="h-full" style={{ width: `${dept.score * 10}%`, background: color }} />
      </div>
    </button>
  );
}
