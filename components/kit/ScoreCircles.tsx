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
 * The score blobs (Bright Spot / Watch Out). Only the circles a pillar has
 * earned are drawn (lib/insight.ts): both side by side, or one on its own,
 * centred at the same size. An empty slot used to show a "nothing here" circle;
 * the owner found an empty circle looks broken (2026-10-09), so it's left out.
 * Renders nothing when neither is earned. Tapping a circle opens that pillar's
 * detail screen via `onSelect`. Shared by the employee and manager (Play mode)
 * dashboards so both use the exact same design.
 */
type Spot = { score: number; pillar: string; pillarId: PillarId };

export function ScoreCircles({
  bright,
  watch,
  onSelect,
}: {
  bright: Spot | null;
  watch: Spot | null;
  onSelect: (pillarId: PillarId) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const spots = [
    bright && { kind: "bright" as const, label: COPY.mood.brightSpot, spot: bright },
    watch && { kind: "watch" as const, label: COPY.mood.watchOut, spot: watch },
  ].filter((s) => s !== null);

  useEffect(() => {
    const items = ref.current ? Array.from(ref.current.children) : [];
    if (items.length === 0) return;
    gsap.to(items, { scale: BASE, y: 0, opacity: 1, duration: DUR, ease: EASE });
    return () => gsap.killTweensOf(items);
  }, [spots.length]);

  if (spots.length === 0) return null;

  return (
    <div ref={ref} className="flex items-center justify-center gap-4 px-1 py-1">
      {spots.map(({ kind, label, spot }) => (
        <div
          key={kind}
          // Half the row each, so a lone circle is the same size as a pair.
          className="w-[calc(50%-0.5rem)] min-w-0 cursor-pointer active:scale-95"
          onClick={() => onSelect(spot.pillarId)}
        >
          <StatCircle kind={kind} label={label} score={spot.score} pillar={spot.pillar} />
        </div>
      ))}
    </div>
  );
}
