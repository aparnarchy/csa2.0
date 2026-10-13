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
 *
 * `others` (employee dashboard): the remaining pillars as a row of small
 * pills under the circles (name + score), so all four pillars sit together.
 * They pop in once the circles have settled. The bubbles tucked into the
 * circles that came before looked busy (owner, 2026-10-13: option A, pills).
 * The manager dashboard passes none.
 *
 * Tapping a circle or pill opens that pillar's detail screen via `onSelect`.
 */
type Spot = { score: number; pillar: string; pillarId: PillarId };
export type PillarBubble = {
  pillarId: PillarId;
  pillar: string;
  score: number | null;
};

export function ScoreCircles({
  bright,
  watch,
  others = [],
  onSelect,
}: {
  bright: Spot | null;
  watch: Spot | null;
  others?: PillarBubble[];
  onSelect: (pillarId: PillarId) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const spots = [
    bright && {
      kind: "bright" as const,
      label: COPY.mood.brightSpot,
      spot: bright,
    },
    watch && { kind: "watch" as const, label: COPY.mood.watchOut, spot: watch },
  ].filter((s) => s !== null);

  useEffect(() => {
    const items = ref.current ? Array.from(ref.current.children) : [];
    if (items.length === 0) return;
    gsap.to(items, {
      scale: BASE,
      y: 0,
      opacity: 1,
      duration: DUR,
      ease: EASE,
    });
    return () => gsap.killTweensOf(items);
  }, [spots.length]);

  if (spots.length === 0 && others.length === 0) return null;

  return (
    <div>
      {spots.length > 0 && (
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
      )}
      {others.length > 0 && (
        <div className={`flex flex-wrap justify-center gap-2 ${spots.length > 0 ? "mt-3" : ""}`}>
          {others.map((b, i) => (
            <Pill key={b.pillarId} b={b} delay={spots.length > 0 ? 0.55 + i * 0.08 : i * 0.08} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One pillar pill: name and score. Pops in after the circles have settled. */
function Pill({ b, delay, onSelect }: { b: PillarBubble; delay: number; onSelect: (pillarId: PillarId) => void }) {
  const empty = b.score === null;
  return (
    <button
      type="button"
      onClick={() => onSelect(b.pillarId)}
      aria-label={`${b.pillar} ${empty ? COPY.mood.pillarEmpty : b.score!.toFixed(1)}`}
      className="bubble-pop inline-flex items-baseline gap-2 rounded-full bg-white px-3.5 py-2 shadow-[0_6px_16px_-8px_rgba(100,80,200,0.35)] ring-1 ring-[#E3DCFF] transition active:scale-95"
      style={{ animationDelay: `${delay}s`, animationFillMode: "both" }}
    >
      <span className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-brand-light">{b.pillar}</span>
      <span className={`font-display text-[16px] font-black leading-none ${empty ? "text-ink-4/60" : "text-brand"}`}>
        {empty ? "–" : b.score!.toFixed(1)}
      </span>
    </button>
  );
}
