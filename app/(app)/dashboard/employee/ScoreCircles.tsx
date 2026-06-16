"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { StatCircle } from "@/components/kit";

type Which = "bright" | "watch";

const S = 150; // base circle size (px)
const GAP = 26; // baseline gap between the two
const HC = 210; // container height (px)
const BIG = 1.28; // expanded big scale (proportionate, not giant)
const SMALL = 0.78; // expanded small scale (tucked bottom-left)

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The two score blobs, animated with GSAP. Baseline: side by side with a gentle
 * idle zoom in/out. Tap one → it grows (bigger number/title) while the other
 * shrinks to the bottom-left (no overlap); tap the other to swap. Click anywhere
 * else on the screen → back to baseline. Easing is elegant (slower, sharper).
 */
export function ScoreCircles({
  bright,
  watch,
}: {
  bright: { score: number; pillar: string };
  watch: { score: number; pillar: string };
}) {
  const [expanded, setExpanded] = useState<Which | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const aRef = useRef<HTMLDivElement>(null); // bright
  const bRef = useRef<HTMLDivElement>(null); // watch

  useIso(() => {
    const wrap = wrapRef.current;
    const a = aRef.current;
    const b = bRef.current;
    if (!wrap || !a || !b) return;

    let idleTween: gsap.core.Tween | null = null;
    const DUR = 0.7;
    const EASE = "power3.inOut";
    const place = (el: Element, cx: number, cy: number, scale: number, onComplete?: () => void) =>
      gsap.to(el, { x: cx - S / 2, y: cy - S / 2, scale, duration: DUR, ease: EASE, onComplete });

    const layout = () => {
      const W = wrap.offsetWidth;
      idleTween?.kill();
      gsap.killTweensOf([a, b]);

      if (!expanded) {
        const startX = (W - (2 * S + GAP)) / 2;
        const cy = HC / 2;
        place(a, startX + S / 2, cy, 1, () => {
          idleTween = gsap.to([a, b], {
            scale: "+=0.035",
            duration: 2.6,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          });
        });
        place(b, startX + S + GAP + S / 2, cy, 1);
      } else {
        const big = expanded === "bright" ? a : b;
        const small = expanded === "bright" ? b : a;
        place(big, W * 0.62, HC / 2, BIG);
        const r = (S * SMALL) / 2;
        place(small, 8 + r, HC - 8 - r, SMALL);
      }
    };

    layout();
    window.addEventListener("resize", layout);
    return () => {
      window.removeEventListener("resize", layout);
      idleTween?.kill();
      gsap.killTweensOf([a, b]);
    };
  }, [expanded]);

  // Click anywhere else on the screen → reset to baseline.
  useEffect(() => {
    if (!expanded) return;
    const onDoc = () => setExpanded(null);
    const id = window.setTimeout(() => document.addEventListener("click", onDoc), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("click", onDoc);
    };
  }, [expanded]);

  const tap = (w: Which) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((p) => (p === w ? null : w));
  };

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height: HC }}>
      <div
        ref={aRef}
        onClick={tap("bright")}
        className="absolute left-0 top-0 w-[150px] cursor-pointer will-change-transform"
      >
        <StatCircle kind="bright" label="Your Bright Spot" score={bright.score} pillar={bright.pillar} />
      </div>
      <div
        ref={bRef}
        onClick={tap("watch")}
        className="absolute left-0 top-0 w-[150px] cursor-pointer will-change-transform"
      >
        <StatCircle kind="watch" label="Watch out" score={watch.score} pillar={watch.pillar} />
      </div>
    </div>
  );
}
