"use client";

import { useEffect, useState } from "react";
import {
  Card,
  GradientHeader,
  InsightBarRow,
  Mascot,
  SegmentedToggle,
  TrendChart,
} from "@/components/kit";
import { PILLARS } from "@/lib/pillars";
import { type Window } from "@/lib/data";
import { getTeamPillarDetailAction } from "./actions";
import { HEADER_MASCOT_SIZE, mascotForScore } from "@/lib/mascot";
import type { PillarId } from "@/lib/types";

type Detail = Awaited<ReturnType<typeof getTeamPillarDetailAction>>;

/**
 * Team-level pillar drill-down, reached by tapping a pillar card on the manager
 * dashboard. Same shape as the employee's PillarDetailView (score, trend,
 * Strengths/Concerns question list) but scoped to the team aggregate — never an
 * individual's answer.
 */
export function TeamPillarDetailView({
  pillarId,
  onBack,
}: {
  pillarId: PillarId;
  onBack: () => void;
}) {
  const meta = PILLARS[pillarId];
  const [window, setWindow] = useState<Window>("3M");
  const [tab, setTab] = useState<"strengths" | "concerns">("strengths");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    getTeamPillarDetailAction(pillarId, window).then(setDetail);
  }, [pillarId, window]);

  const questions = [...(detail?.questions ?? [])].sort((a, b) => b.score - a.score);
  const shown = tab === "strengths" ? questions.slice(0, 3) : questions.slice(-3).reverse();
  const up = (detail?.delta ?? 0) >= 0;

  return (
    <div className="screen-enter space-y-3.5">
      <GradientHeader
        eyebrow="Team pillar"
        title={meta.label}
        back={{ label: "Dashboard", onClick: onBack }}
        avatar={detail ? <Mascot state={mascotForScore(detail.score, true)} size={HEADER_MASCOT_SIZE} /> : undefined}
      >
        {detail && (
          <div className="mt-3 flex items-end gap-3.5">
            <span className="font-display text-[56px] font-black leading-none text-[#8B82F6]">
              {detail.score.toFixed(1)}
            </span>
            <div className="pb-2.5">
              <div className="text-sm font-bold text-ink-2">
                {up ? "↑" : "↓"} {Math.abs(detail.delta ?? 0).toFixed(1)}
              </div>
              <div className="mt-0.5 text-xs text-ink-3">{detail.percentile}th percentile</div>
            </div>
          </div>
        )}
      </GradientHeader>

      <TrendChart data={detail?.trend ?? []} window={window} onWindowChange={setWindow} accent="#7C6FFF" />

      <Card>
        <p className="mb-3 text-sm font-bold text-brand">Insights</p>
        <div className="mb-4">
          <SegmentedToggle
            value={tab}
            onChange={(v) => {
              setTab(v);
              setOpenId(null);
            }}
            options={[
              { value: "strengths", label: "💪 Strengths" },
              { value: "concerns", label: "⚠️ Concerns" },
            ]}
          />
        </div>
        {shown.map((q) => (
          <InsightBarRow
            key={q.id}
            q={q}
            isStrength={tab === "strengths"}
            open={openId === q.id}
            onToggle={() => setOpenId((cur) => (cur === q.id ? null : q.id))}
          />
        ))}
        {shown.length === 0 && <p className="text-xs text-ink-4">Not enough responses yet for this pillar.</p>}
      </Card>
    </div>
  );
}
