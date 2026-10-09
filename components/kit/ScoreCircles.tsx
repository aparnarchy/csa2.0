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
 * `others` (employee dashboard): the remaining pillars as small white bubbles
 * tucked under the blobs, so all four pillars read as one cluster — one bubble
 * under each blob when both are earned, or an arc of three around a lone blob.
 * They pop in once the blobs have settled. The manager dashboard passes none.
 *
 * Tapping a circle or bubble opens that pillar's detail screen via `onSelect`.
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

  // A lone circle with three bubbles: one bubble either side of the circle's
  // lower half and one tucked under its middle, so they sit around it rather
  // than in a row across it. The circle is half the row wide and centred, so
  // its edges are at 25% and 75% of the row (less half the 1rem gap).
  const orbit = spots.length === 1 && others.length === 3;

  return (
    <div>
      {spots.length > 0 && (
        <div className="relative">
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
          {orbit && (
            <>
              <Bubble
                b={others[0]}
                size={ORBIT_SIZE}
                delay={0.55}
                onSelect={onSelect}
                style={{
                  position: "absolute",
                  top: "52%",
                  right: "calc(75% - 0.25rem + 2px)",
                }}
              />
              <Bubble
                b={others[2]}
                size={ORBIT_SIZE}
                delay={0.71}
                onSelect={onSelect}
                style={{
                  position: "absolute",
                  top: "52%",
                  left: "calc(75% - 0.25rem + 2px)",
                }}
              />
            </>
          )}
        </div>
      )}
      {orbit ? (
        <div className="relative z-10 flex justify-center" style={{ marginTop: -34 }}>
          <Bubble b={others[1]} size={ORBIT_SIZE} delay={0.63} onSelect={onSelect} />
        </div>
      ) : (
        others.length > 0 && (
          <Bubbles others={others} tucked={spots.length > 0} paired={spots.length === 2} onSelect={onSelect} />
        )
      )}
    </div>
  );
}

/** Bubble size around a lone circle: the room either side of it on a small phone. */
const ORBIT_SIZE = 74;

/**
 * The small pillar bubbles in a row. Paired (two circles above): one bubble
 * centred under each circle. With no circles: a plain row.
 */
function Bubbles({
  others,
  tucked,
  paired,
  onSelect,
}: {
  others: PillarBubble[];
  tucked: boolean;
  paired: boolean;
  onSelect: (pillarId: PillarId) => void;
}) {
  const size = others.length >= 4 ? 70 : 82;
  return (
    <div
      className={`relative z-10 ${paired ? "grid grid-cols-2 gap-4 px-1" : "flex justify-center gap-2.5"}`}
      style={{ marginTop: tucked ? -30 : 4 }}
    >
      {others.map((b, i) => (
        <div key={b.pillarId} className="flex justify-center">
          <Bubble b={b} size={size} delay={0.55 + i * 0.08} onSelect={onSelect} />
        </div>
      ))}
    </div>
  );
}

/** One white pillar bubble; pops in after the circles have settled. */
function Bubble({
  b,
  size,
  delay,
  onSelect,
  style,
}: {
  b: PillarBubble;
  size: number;
  delay: number;
  onSelect: (pillarId: PillarId) => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(b.pillarId)}
      aria-label={`${b.pillar} ${b.score === null ? COPY.mood.pillarEmpty : b.score.toFixed(1)}`}
      className="bubble-pop z-10 flex flex-col items-center justify-center rounded-full bg-white px-2 text-center shadow-[0_10px_22px_-10px_rgba(100,80,200,0.45)] ring-[1.5px] ring-[#E3DCFF] transition active:scale-95"
      style={{
        width: size,
        height: size,
        animationDelay: `${delay}s`,
        animationFillMode: "both",
        ...style,
      }}
    >
      <span
        className={`font-display font-black leading-none ${size < 80 ? "text-[18px]" : "text-[20px]"} ${
          b.score === null ? "text-ink-4/60" : "text-brand"
        }`}
      >
        {b.score === null ? "–" : b.score.toFixed(1)}
      </span>
      <span className="mt-1 text-[7px] font-extrabold uppercase leading-[1.15] tracking-[0.04em] text-brand-light">
        {b.pillar}
      </span>
    </button>
  );
}
