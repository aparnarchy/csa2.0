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
import { PILLARS, STRENGTH_CUTOFF } from "@/lib/pillars";
import { type Window } from "@/lib/data";
import { getCeoPillarDetailAction } from "./actions";
import { HEADER_MASCOT_SIZE, mascotForScore } from "@/lib/mascot";
import type { PillarId } from "@/lib/types";

type Detail = Awaited<ReturnType<typeof getCeoPillarDetailAction>>;

/**
 * Pillar drill-down at whatever scope the caller is viewing (org, a
 * department, or a team) — same shape as the employee/manager pillar detail
 * screens. Shared by the department-detail (dashboard) and Insights screens.
 */
export function CeoPillarDetailView({
  scope,
  pillarId,
  onBack,
}: {
  scope: string;
  pillarId: PillarId;
  onBack: () => void;
}) {
  const meta = PILLARS[pillarId];
  const [window, setWindow] = useState<Window>("3M");
  const [tab, setTab] = useState<"strengths" | "concerns">("strengths");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    getCeoPillarDetailAction(scope, pillarId, window).then(setDetail);
  }, [scope, pillarId, window]);

  const questions = [...(detail?.questions ?? [])].sort((a, b) => b.score - a.score);
  const strengths = questions.filter((q) => q.score >= STRENGTH_CUTOFF).slice(0, 3);
  const concerns = questions.filter((q) => q.score < STRENGTH_CUTOFF).reverse().slice(0, 3);
  const shown = tab === "strengths" ? strengths : concerns;
  const up = (detail?.delta ?? 0) >= 0;

  return (
    <div className="screen-enter space-y-3.5">
      <GradientHeader
        eyebrow="Pillar"
        title={meta.label}
        back={{ label: "Back", onClick: onBack }}
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
        {shown.length === 0 && (
          <p className="text-xs text-ink-4">
            {tab === "strengths" ? "Nothing scoring 7+ yet." : "Nothing scoring below 7 — nice."}
          </p>
        )}
      </Card>

      <TrendChart data={detail?.trend ?? []} window={window} onWindowChange={setWindow} accent="#7C6FFF" />
    </div>
  );
}
