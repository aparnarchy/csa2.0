"use client";

import { useEffect, useState } from "react";
import {
  Card,
  GradientHeader,
  InsightBarRow,
  SegmentedToggle,
  TrendChart,
} from "@/components/kit";
import { PILLARS } from "@/lib/pillars";
import { getPillarDetail, type Window } from "@/lib/data";
import type { PillarId, SessionUser } from "@/lib/types";

type Detail = Awaited<ReturnType<typeof getPillarDetail>>;

export function PillarDetailView({
  session,
  pillarId,
  onBack,
  onGoToInbox,
}: {
  session: SessionUser;
  pillarId: PillarId;
  onBack: () => void;
  onGoToInbox?: () => void;
}) {
  const meta = PILLARS[pillarId];
  const [window, setWindow] = useState<Window>("3M");
  const [tab, setTab] = useState<"strengths" | "concerns">("concerns");
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    getPillarDetail(session, session.id, pillarId, window).then(setDetail);
  }, [session, pillarId, window]);

  const questions = [...(detail?.questions ?? [])].sort((a, b) => b.score - a.score);
  const shown = tab === "strengths" ? questions.slice(0, 3) : questions.slice(-3).reverse();
  const up = (detail?.delta ?? 0) >= 0;

  return (
    <div className="screen-enter space-y-3.5">
      <GradientHeader
        eyebrow="Pillar"
        title={meta.label}
        accent={meta.hex}
        accentTo={`${meta.hex}CC`}
        back={{ label: "Dashboard", onClick: onBack }}
      >
        {detail && (
          <div className="mt-3 flex items-end gap-3.5">
            <span className="font-display text-[56px] font-black leading-none text-white">
              {detail.score.toFixed(1)}
            </span>
            <div className="pb-2.5">
              <div className="text-sm font-bold text-white/90">
                {up ? "↑" : "↓"} {Math.abs(detail.delta ?? 0).toFixed(1)}
              </div>
              <div className="mt-0.5 text-xs text-white/65">{detail.percentile}th percentile</div>
            </div>
          </div>
        )}
      </GradientHeader>

      <TrendChart data={detail?.trend ?? []} window={window} onWindowChange={setWindow} accent={meta.hex} />

      <Card>
        <p className="mb-3 text-sm font-bold text-ink">Insights</p>
        <div className="mb-4">
          <SegmentedToggle
            value={tab}
            onChange={setTab}
            options={[
              { value: "strengths", label: "💪 Strengths" },
              { value: "concerns", label: "⚠️ Concerns" },
            ]}
          />
        </div>
        {shown.map((q) => (
          <InsightBarRow key={q.id} q={q} isStrength={tab === "strengths"} onGoToInbox={onGoToInbox} />
        ))}
        {shown.length === 0 && <p className="text-xs text-ink-4">No data for this pillar.</p>}
      </Card>
    </div>
  );
}
