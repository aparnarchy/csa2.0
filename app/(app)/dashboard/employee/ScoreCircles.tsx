"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { StatCircle } from "@/components/kit";

type Which = "bright" | "watch";

const BASE = 1.04; // baseline 4% bigger
const DUR = 1.0; // slow, elegant transition
const EASE = "power2.inOut";

/**
 * The two score blobs, animated with GSAP. Baseline: side by side with a muted
 * idle zoom. Tap one → it grows (the other shrinks up to the side) and the text
 * scales proportionally with the circle. Tap again / the other to swap / reset.
 */
export function ScoreCircles({
  bright,
  watch,
}: {
  bright: { score: number; pillar: string };
  watch: { score: number; pillar: string };
}) {
  const [expanded, setExpanded] = useState<Which | null>(null);
  const aRef = useRef<HTMLDivElement>(null); // bright
  const bRef = useRef<HTMLDivElement>(null); // watch

  useEffect(() => {
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;
    const ca = a.querySelector(".sc-content");
    const cb = b.querySelector(".sc-content");
    if (!ca || !cb) return;
    gsap.killTweensOf([a, b, ca, cb]);

    if (!expanded) {
      gsap.to([a, b], {
        flexGrow: 1,
        scale: BASE,
        y: 0,
        opacity: 1,
        duration: DUR,
        ease: EASE,
        onComplete: () => {
          gsap.to([a, b], {
            scale: BASE + 0.016,
            duration: 2.8,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          });
        },
      });
      gsap.to([ca, cb], { scale: 1, duration: DUR, ease: EASE });
    } else {
      const big = expanded === "bright" ? a : b;
      const small = expanded === "bright" ? b : a;
      const bigC = expanded === "bright" ? ca : cb;
      const smallC = expanded === "bright" ? cb : ca;
      // circle footprint via flexGrow; text scales proportionally via content
      gsap.to(big, { flexGrow: 1.5, scale: BASE, y: 0, opacity: 1, duration: DUR, ease: EASE });
      gsap.to(small, { flexGrow: 1.1, scale: BASE, y: -8, opacity: 0.95, duration: DUR, ease: EASE });
      gsap.to(bigC, { scale: 1.15, duration: DUR, ease: EASE });
      gsap.to(smallC, { scale: 0.85, duration: DUR, ease: EASE });
    }

    return () => gsap.killTweensOf([a, b, ca, cb]);
  }, [expanded]);

  const toggle = (w: Which) => setExpanded((p) => (p === w ? null : w));

  return (
    <div className="flex items-center gap-4 px-1 py-1">
      <div ref={aRef} className="min-w-0 flex-1 cursor-pointer" onClick={() => toggle("bright")}>
        <StatCircle kind="bright" label="Your Bright Spot" score={bright.score} pillar={bright.pillar} />
      </div>
      <div ref={bRef} className="min-w-0 flex-1 cursor-pointer" onClick={() => toggle("watch")}>
        <StatCircle kind="watch" label="Watch out" score={watch.score} pillar={watch.pillar} />
      </div>
    </div>
  );
}
