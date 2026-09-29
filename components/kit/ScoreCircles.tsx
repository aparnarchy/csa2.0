"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { StatCircle } from "./StatCircle";
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
export function ScoreCircles({
  bright,
  watch,
  onSelect,
}: {
  /** `label` comes from lib/mood.ts (topLabel / bottomLabel) so a low score is
   *  never called a bright spot, nor a good one a watch out. */
  bright: { score: number; pillar: string; pillarId: PillarId; label: string };
  watch: { score: number; pillar: string; pillarId: PillarId; label: string };
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
      <div ref={aRef} className="min-w-0 flex-1 cursor-pointer active:scale-95" onClick={() => onSelect(bright.pillarId)}>
        <StatCircle kind="bright" label={bright.label} score={bright.score} pillar={bright.pillar} />
      </div>
      <div ref={bRef} className="min-w-0 flex-1 cursor-pointer active:scale-95" onClick={() => onSelect(watch.pillarId)}>
        <StatCircle kind="watch" label={watch.label} score={watch.score} pillar={watch.pillar} />
      </div>
    </div>
  );
}
