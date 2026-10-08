"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { StatCircle } from "./StatCircle";
import { COPY } from "@/lib/copy";
import type { PillarId } from "@/lib/types";

const BASE = 1.04; // baseline 4% bigger
const DUR = 1.0; // slow, elegant settle
const EASE = "power2.inOut";

/**
 * The two score blobs (Bright Spot / Watch Out). They settle side by side at the
 * baseline (no perpetual idle loop). Tapping a circle opens that pillar's
 * detail screen via `onSelect`. Shared by the employee and manager (Play mode)
 * dashboards so both use the exact same design.
 */
type Spot = { score: number; pillar: string; pillarId: PillarId };

export function ScoreCircles({
  bright,
  watch,
  onSelect,
}: {
  /** From lib/insight.ts: null when no pillar earns the slot (shown empty,
   *  with its "nothing here" line, and not tappable). */
  bright: Spot | null;
  watch: Spot | null;
  onSelect: (pillarId: PillarId) => void;
}) {
  const aRef = useRef<HTMLDivElement>(null); // bright
  const bRef = useRef<HTMLDivElement>(null); // watch

  useEffect(() => {
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;
    gsap.to([a, b], { flexGrow: 1, scale: BASE, y: 0, opacity: 1, duration: DUR, ease: EASE });
    return () => gsap.killTweensOf([a, b]);
  }, []);

  return (
    <div className="flex items-center gap-4 px-1 py-1">
      <div
        ref={aRef}
        className={`min-w-0 flex-1 ${bright ? "cursor-pointer active:scale-95" : ""}`}
        onClick={bright ? () => onSelect(bright.pillarId) : undefined}
      >
        <StatCircle
          kind="bright"
          label={COPY.mood.brightSpot}
          score={bright?.score ?? null}
          pillar={bright?.pillar ?? ""}
          emptyText={COPY.mood.noBrightSpot}
        />
      </div>
      <div
        ref={bRef}
        className={`min-w-0 flex-1 ${watch ? "cursor-pointer active:scale-95" : ""}`}
        onClick={watch ? () => onSelect(watch.pillarId) : undefined}
      >
        <StatCircle
          kind="watch"
          label={COPY.mood.watchOut}
          score={watch?.score ?? null}
          pillar={watch?.pillar ?? ""}
          emptyText={COPY.mood.noWatchOut}
        />
      </div>
    </div>
  );
}
