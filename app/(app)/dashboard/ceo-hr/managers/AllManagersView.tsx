"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, GradientHeader, NotEnoughData, CEO_NAV, ScreenShell } from "@/components/kit";
import { type ManagerSummary, type ReviewingManagerList } from "@/lib/data";
import { getManagerRankingsAction } from "../actions";

const BAND_COLOR: Record<"green" | "amber" | "red", string> = {
  green: "#059669",
  amber: "#b45309",
  red: "#dc2626",
};

/**
 * Every manager, ranked by team score — the click-through from the Insights
 * tab's top/bottom summary. Same underlying data (getReviewingManagerList) the
 * removed reviewing-manager role used to see; now reached from CEO/HR only.
 */
export function AllManagersView({ initial }: { initial: ReviewingManagerList }) {
  const router = useRouter();
  const [data, setData] = useState<ReviewingManagerList>(initial);

  useEffect(() => {
    getManagerRankingsAction("3M").then(setData);
  }, []);

  return (
    <ScreenShell active="insights" navItems={CEO_NAV}>
      <GradientHeader
        eyebrow="👥 All managers"
        title="Ranked by team score"
        back={{ label: "Insights", onClick: () => router.push("/dashboard/ceo-hr/insights") }}
      />

      <Card>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-brand">Org average</p>
            <span className="block font-display text-[44px] font-black leading-none text-[#8B82F6]">
              {data.orgAvg !== null ? data.orgAvg.toFixed(1) : "—"}
            </span>
          </div>
          <p className="text-xs text-ink-3">
            {data.shownCount} of {data.managerCount} teams shown
          </p>
        </div>
      </Card>

      <div className="space-y-2.5">
        {data.managers.map((m) => (
          <ManagerRow
            key={m.managerId}
            manager={m}
            rank={m.enoughData ? rankOf(data.managers, m) : null}
            onOpen={() => m.enoughData && router.push(`/dashboard/ceo-hr/managers/${m.managerId}`)}
          />
        ))}
        {data.managerCount === 0 && <NotEnoughData message="No managers yet." />}
      </div>

      <p className="pb-2 text-center text-[11px] text-ink-4">
        Ranked by team score. No participation rate is shown next to any name.
      </p>
    </ScreenShell>
  );
}

function rankOf(all: ManagerSummary[], m: ManagerSummary): number {
  const scored = all.filter((x) => x.enoughData);
  return scored.findIndex((x) => x.managerId === m.managerId) + 1;
}

function ManagerRow({
  manager,
  rank,
  onOpen,
}: {
  manager: ManagerSummary;
  rank: number | null;
  onOpen: () => void;
}) {
  if (!manager.enoughData) {
    return (
      <div className="flex items-center gap-3 rounded-card border border-gray-200 bg-gray-50 p-4 opacity-70">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-lg">
          🔒
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-black text-ink-2">{manager.name}</p>
          <p className="text-[11px] text-ink-4">Below the anonymity floor — no score shown</p>
        </div>
      </div>
    );
  }

  const color = manager.band ? BAND_COLOR[manager.band] : "#8B82F6";
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
          {manager.teamScore!.toFixed(1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {rank && (
              <span className="rounded-full bg-lav-soft px-1.5 py-0.5 text-[10px] font-bold text-brand">
                #{rank}
              </span>
            )}
            <p className="truncate font-display text-base font-black text-ink">{manager.name}</p>
          </div>
          <p className="mt-0.5 text-[11px] text-ink-3">
            {manager.percentile}th percentile
            {manager.resolutionPct != null && ` · ${manager.resolutionPct}% actions resolved`}
          </p>
        </div>
        <span className="flex-shrink-0 text-brand-light">→</span>
      </div>
      <div className="h-1 w-full bg-lav-soft">
        <div className="h-full" style={{ width: `${manager.teamScore! * 10}%`, background: color }} />
      </div>
    </button>
  );
}
