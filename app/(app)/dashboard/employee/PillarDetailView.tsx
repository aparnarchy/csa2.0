"use client";

import { useEffect, useState } from "react";
import {
  Card,
  emptyInsightLine,
  GradientHeader,
  InsightBarRow,
  LoadFailed,
  Mascot,
  PillarScoreBlock,
  SegmentedToggle,
  TrendChart,
  WINS_LABEL,
  WORRIES_LABEL,
  ShowMoreButton,
  visibleRows,
} from "@/components/kit";
import { PILLARS, STRENGTH_CUTOFF } from "@/lib/pillars";
import { type Window } from "@/lib/data";
import { getPillarDetailAction } from "./actions";
import { HEADER_MASCOT_SIZE, mascotForScore } from "@/lib/mascot";
import type { PillarId } from "@/lib/types";
import { withRetry } from "@/lib/retry";

type Detail = Awaited<ReturnType<typeof getPillarDetailAction>>;

export function PillarDetailView({
  pillarId,
  onBack,
  onGoToInbox,
}: {
  pillarId: PillarId;
  onBack: () => void;
  onGoToInbox?: () => void;
}) {
  const meta = PILLARS[pillarId];
  const [window, setWindow] = useState<Window>("3M");
  const [tab, setTab] = useState<"strengths" | "concerns">("strengths");
  const [detail, setDetail] = useState<Detail | null>(null);
  /** The load failed even after a retry: show "tap to try again", not a spinner. */
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /** Accordion: at most one question row is expanded at a time. */
  const [showAll, setShowAll] = useState(false);
  // undefined = nothing chosen yet → the first row starts open.
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setFailed(false);
    withRetry(() => getPillarDetailAction(pillarId, window)).then(setDetail, () => setFailed(true));
  }, [pillarId, window, attempt]);

  const questions = [...(detail?.questions ?? [])].sort((a, b) => b.score - a.score);
  const strengths = questions.filter((q) => q.score > STRENGTH_CUTOFF);
  const concerns = questions.filter((q) => q.score <= STRENGTH_CUTOFF).reverse();
  const shownAll = tab === "strengths" ? strengths : concerns;
  const shown = visibleRows(shownAll, showAll);

  return (
    <div className="screen-enter space-y-3.5">
      <GradientHeader
        eyebrow="Pillar"
        title={meta.label}
        back={{ label: "Dashboard", onClick: onBack }}
        avatar={detail ? <Mascot state={mascotForScore(detail.score, detail.score !== null)} size={HEADER_MASCOT_SIZE} /> : undefined}
      >
        {detail && <PillarScoreBlock score={detail.score} delta={detail.delta} />}
      </GradientHeader>

      {failed && !detail && <LoadFailed onRetry={() => setAttempt((a) => a + 1)} />}

      <Card>
        <p className="mb-3 text-sm font-bold text-brand">Insights</p>
        <div className="mb-4">
          <SegmentedToggle
            value={tab}
            onChange={(v) => {
              setTab(v);
              setOpenId(undefined);
              setShowAll(false);
            }}
            options={[
              { value: "strengths", label: WINS_LABEL },
              { value: "concerns", label: WORRIES_LABEL },
            ]}
          />
        </div>
        {shown.map((q, qi) => (
          <InsightBarRow
            key={q.id}
            q={q}
            isStrength={tab === "strengths"}
            open={openId === undefined ? qi === 0 : openId === q.id}
            onToggle={() => setOpenId((cur) => ((cur === undefined ? qi === 0 : cur === q.id) ? null : q.id))}
            onGoToInbox={onGoToInbox}
          />
        ))}
        <ShowMoreButton total={shownAll.length} expanded={showAll} onToggle={() => setShowAll((v) => !v)} />
        {shown.length === 0 && (
          <p className="text-xs text-ink-4">
            {emptyInsightLine(questions.length > 0, tab)}
          </p>
        )}
      </Card>

      {detail?.trendReady && <TrendChart data={detail.trend} window={window} onWindowChange={setWindow} accent="#7C6FFF" />}
    </div>
  );
}
