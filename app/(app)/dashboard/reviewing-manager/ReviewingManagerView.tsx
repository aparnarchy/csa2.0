"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, GradientHeader, Mascot, NotEnoughData, ScreenShell } from "@/components/kit";
import { type ManagerSummary, type ReviewingManagerList } from "@/lib/data";
import { getReviewingManagerListAction } from "./actions";
import { HEADER_MASCOT_SIZE, mascotForScore } from "@/lib/mascot";
import type { SessionUser } from "@/lib/types";

const BAND_COLOR: Record<"green" | "amber" | "red", string> = {
  green: "#059669",
  amber: "#b45309",
  red: "#dc2626",
};

export function ReviewingManagerView({
  session,
  initial,
}: {
  session: SessionUser;
  initial: ReviewingManagerList;
}) {
  const router = useRouter();
  const [data, setData] = useState<ReviewingManagerList>(initial);

  // Refresh on mount so the list stays current (real D1 via server action).
  useEffect(() => {
    getReviewingManagerListAction("3M").then(setData);
  }, []);

  const isPlay = session.themeMode === "play";
  const firstName = (session.name || "there").trim().split(/\s+/)[0];

  return (
    <ScreenShell active="insights">
      {/* Header — Play: lavender card + mascot; Professional: gradient card, no mascot. */}
      {isPlay ? (
        <GradientHeader
          eyebrow="🔭 Reviewing managers"
          title={`${firstName}'s managers`}
          avatar={
            <Mascot
              state={mascotForScore(data.orgAvg, data.shownCount > 0)}
              size={HEADER_MASCOT_SIZE}
              float={false}
              sparkle={false}
            />
          }
          className="flex min-h-[180px] flex-col justify-center"
        >
          <p className="mt-2 text-sm font-bold text-brand">
            Team aggregates only — never an individual.
          </p>
        </GradientHeader>
      ) : (
        <div
          className="rounded-card px-5 py-6"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <p className="text-xs font-semibold text-brand/70">🔭 Reviewing managers</p>
          <h1 className="mt-1 font-display text-[30px] font-black leading-tight text-brand">
            {firstName}&apos;s managers
          </h1>
          <p className="mt-2 font-display text-base font-black leading-snug text-brand-light">
            Team aggregates only — never an individual.
          </p>
        </div>
      )}

      {/* Org average across the reviewer's managers */}
      <Card>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-brand">Across your managers</p>
            <span className="block font-display text-[44px] font-black leading-none text-[#8B82F6]">
              {data.orgAvg !== null ? data.orgAvg.toFixed(1) : "—"}
            </span>
          </div>
          <p className="text-xs text-ink-3">
            {data.shownCount} of {data.managerCount} teams shown
          </p>
        </div>
      </Card>

      {/* Ranked manager cards */}
      <p className="px-1 pt-1 font-display text-sm font-black text-ink">My managers</p>
      <div className="space-y-2.5">
        {data.managers.map((m) => (
          <ManagerRow
            key={m.managerId}
            manager={m}
            rank={m.enoughData ? rankOf(data.managers, m) : null}
            onOpen={() => m.enoughData && router.push(`/dashboard/reviewing-manager/${m.managerId}`)}
          />
        ))}
        {data.managerCount === 0 && (
          <NotEnoughData message="No managers report to you yet." />
        )}
      </div>

      <p className="pb-2 text-center text-[11px] text-ink-4">
        Ranked by team score. No participation rate is shown next to any name.
      </p>
    </ScreenShell>
  );
}

/** Rank among the scored managers (1-based), or null if below the floor. */
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
