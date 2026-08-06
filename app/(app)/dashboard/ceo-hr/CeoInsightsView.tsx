"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CustomDropdown, GradientHeader, CEO_NAV, ScreenShell, SegmentedToggle } from "@/components/kit";
import { type CeoDashboard, type ManagerSummary, type ReviewingManagerList, type Window } from "@/lib/data";
import type { DepartmentScore } from "@/lib/ceo";
import {
  getCeoDashboardAction,
  getDepartmentScoresAction,
  getManagerRankingsAction,
} from "./actions";
import { PILLARS } from "@/lib/pillars";
import type { PillarId, SessionUser } from "@/lib/types";
import { CeoPillarDetailView } from "./CeoPillarDetailView";

type HighLow = "high" | "low";
const BAND_COLOR: Record<"green" | "amber" | "red", string> = {
  green: "#059669",
  amber: "#b45309",
  red: "#dc2626",
};

const TIME_OPTS: [string, string][] = [
  ["1M", "1 Month"], ["3M", "3 Months"], ["6M", "6 Months"], ["1Y", "1 Year"], ["All", "All time"],
];

/**
 * The CEO/HR "Insights" tab: department scores as a bar chart, top/bottom
 * managers (with a click-through to see all of them), then a scoped
 * (org/dept/team) pillar ranking with clickable pillars. Replaces what the
 * old combined dashboard + the removed reviewing-manager role used to cover.
 */
export function CeoInsightsView({
  session,
  initialDepts,
  initialManagers,
  initialScoped,
}: {
  session: SessionUser;
  initialDepts: DepartmentScore[];
  initialManagers: ReviewingManagerList;
  initialScoped: CeoDashboard;
}) {
  const router = useRouter();
  const [window, setWindow] = useState<Window>("3M");
  const [depts, setDepts] = useState<DepartmentScore[]>(initialDepts);
  const [managers, setManagers] = useState<ReviewingManagerList>(initialManagers);
  const [scope, setScope] = useState<string>(initialScoped.scope);
  const [scoped, setScoped] = useState<CeoDashboard>(initialScoped);
  const [highLow, setHighLow] = useState<HighLow>("high");
  const [selectedPillar, setSelectedPillar] = useState<PillarId | null>(null);

  useEffect(() => {
    getDepartmentScoresAction(window).then(setDepts);
    getManagerRankingsAction(window).then(setManagers);
  }, [window]);

  useEffect(() => {
    getCeoDashboardAction(scope, window).then(setScoped);
  }, [scope, window]);

  const isPlay = session.themeMode === "play";
  const dropdownOptions = scoped.options.map((o) => [o.value, o.label] as [string, string]);

  const ranked = useMemo(() => {
    const withScore = scoped.pillars.filter((p) => p.score !== null);
    return [...withScore].sort((a, b) =>
      highLow === "high" ? (b.score ?? 0) - (a.score ?? 0) : (a.score ?? 0) - (b.score ?? 0),
    );
  }, [scoped.pillars, highLow]);

  const scoredManagers = managers.managers.filter((m) => m.enoughData && m.teamScore !== null);
  const top3 = scoredManagers.slice(0, 3);
  const bottom3 = scoredManagers.length > 3 ? scoredManagers.slice(-3).reverse() : [];
  const maxDeptScore = Math.max(1, ...depts.filter((d) => d.score !== null).map((d) => d.score!));

  if (selectedPillar) {
    return (
      <ScreenShell active="insights" navItems={CEO_NAV}>
        <CeoPillarDetailView scope={scope} pillarId={selectedPillar} onBack={() => setSelectedPillar(null)} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell active="insights" navItems={CEO_NAV}>
      {isPlay ? (
        <GradientHeader eyebrow="📊 Insights" title="Where things stand">
          <div className="mt-3">
            <CustomDropdown value={window} onChange={(v) => setWindow(v as Window)} options={TIME_OPTS} align="left" />
          </div>
        </GradientHeader>
      ) : (
        <div
          className="rounded-card px-5 py-6"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <p className="text-xs font-semibold text-brand/70">📊 Insights</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-brand">Where things stand</h1>
          <div className="mt-3">
            <CustomDropdown value={window} onChange={(v) => setWindow(v as Window)} options={TIME_OPTS} align="left" />
          </div>
        </div>
      )}

      {/* Department scores — bar chart */}
      <Card>
        <p className="mb-3 text-sm font-bold text-brand">Departments</p>
        <div className="space-y-2.5">
          {depts.map((d) => (
            <button
              key={d.deptId}
              type="button"
              onClick={() => router.push(`/dashboard/ceo-hr/dept/${d.deptId}`)}
              disabled={d.score === null}
              className="flex w-full items-center gap-3 text-left disabled:opacity-50"
            >
              <p className="w-24 flex-shrink-0 truncate text-[13px] font-semibold text-ink">{d.name}</p>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-lav-soft">
                {d.score !== null && (
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(d.score / maxDeptScore) * 100}%`,
                      background: d.band ? BAND_COLOR[d.band] : "#8B82F6",
                    }}
                  />
                )}
              </div>
              <span className="w-8 flex-shrink-0 text-right text-[13px] font-black text-ink">
                {d.score !== null ? d.score.toFixed(1) : "—"}
              </span>
            </button>
          ))}
          {depts.length === 0 && <p className="text-xs text-ink-4">No departments set up yet.</p>}
        </div>
      </Card>

      {/* Top / bottom managers, click through to their dashboard */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-brand">Managers</p>
          <button
            type="button"
            onClick={() => router.push("/dashboard/ceo-hr/managers")}
            className="text-xs font-bold text-brand active:scale-[0.98]"
          >
            See all →
          </button>
        </div>
        {scoredManagers.length === 0 ? (
          <p className="text-xs text-ink-4">Not enough data yet.</p>
        ) : (
          <>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-good">Top</p>
            <div className="space-y-1.5">
              {top3.map((m) => (
                <ManagerRow key={m.managerId} manager={m} onOpen={() => router.push(`/dashboard/ceo-hr/managers/${m.managerId}`)} />
              ))}
            </div>
            {bottom3.length > 0 && (
              <>
                <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-wide text-warn">Bottom</p>
                <div className="space-y-1.5">
                  {bottom3.map((m) => (
                    <ManagerRow key={m.managerId} manager={m} onOpen={() => router.push(`/dashboard/ceo-hr/managers/${m.managerId}`)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Card>

      {/* Scoped pillar ranking — org / dept / team, clickable pillars */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm font-bold text-brand">Pillar ranking</p>
          <CustomDropdown value={scope} onChange={setScope} options={dropdownOptions} align="right" />
        </div>
        <p className="mb-3 truncate text-[11px] text-ink-3">Viewing: {scoped.scopeLabel}</p>
        <div className="mb-4 w-full">
          <SegmentedToggle<HighLow>
            value={highLow}
            onChange={setHighLow}
            options={[
              { value: "high", label: "Strengths" },
              { value: "low", label: "Watch-outs" },
            ]}
          />
        </div>
        {!scoped.enoughData ? (
          <p className="text-xs text-ink-4">{scoped.reason}</p>
        ) : (
          <div className="space-y-2">
            {ranked.map((p) => (
              <PillarRankRow key={p.pillarId} pillarId={p.pillarId} score={p.score!} onClick={() => setSelectedPillar(p.pillarId)} />
            ))}
          </div>
        )}
      </Card>

      <p className="pb-2 text-center text-[11px] text-ink-4">
        Aggregates only. No participation rate, and nothing here can identify an individual.
      </p>
    </ScreenShell>
  );
}

function ManagerRow({ manager, onOpen }: { manager: ManagerSummary; onOpen: () => void }) {
  const color = manager.band ? BAND_COLOR[manager.band] : "#8B82F6";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl bg-lav-light px-3 py-2.5 text-left transition active:scale-[0.98]"
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl font-display text-sm font-black"
        style={{ background: "#F2F0FF", color }}
      >
        {manager.teamScore!.toFixed(1)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-ink">{manager.name}</p>
        <p className="text-[11px] text-ink-3">{manager.percentile}th percentile</p>
      </div>
      <span className="flex-shrink-0 text-brand-light">→</span>
    </button>
  );
}

function PillarRankRow({
  pillarId,
  score,
  onClick,
}: {
  pillarId: PillarId;
  score: number;
  onClick: () => void;
}) {
  const color = score >= 7 ? "#059669" : score >= 4 ? "#b45309" : "#dc2626";
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 text-left active:scale-[0.99]">
      <p className="w-28 flex-shrink-0 text-[13px] font-semibold text-ink">{PILLARS[pillarId].label}</p>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-lav-soft">
        <div className="h-full rounded-full" style={{ width: `${score * 10}%`, background: color }} />
      </div>
      <span className="w-8 flex-shrink-0 text-right text-[13px] font-black" style={{ color }}>
        {score.toFixed(1)}
      </span>
      <span className="flex-shrink-0 text-xs text-brand-light">›</span>
    </button>
  );
}
