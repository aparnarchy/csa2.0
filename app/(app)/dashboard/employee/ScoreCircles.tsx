"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { StatCircle } from "@/components/kit";

type Which = "bright" | "watch";

/**
 * The two score blobs, animated with GSAP: a gentle idle zoom in/out, and a
 * click-to-expand — tap one and it grows much bigger while the other shrinks up
 * to the side. Tap it again (or the other) to swap / reset.
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
    gsap.killTweensOf([a, b]);

    if (!expanded) {
      // reset to equal, then a calm idle zoom in/out on both
      gsap.to([a, b], {
        flexGrow: 1,
        scale: 1,
        y: 0,
        opacity: 1,
        duration: 0.5,
        ease: "power3.out",
        onComplete: () => {
          gsap.to([a, b], {
            scale: 1.035,
            duration: 2.4,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          });
        },
      });
    } else {
      const big = expanded === "bright" ? a : b;
      const small = expanded === "bright" ? b : a;
      gsap.to(big, { flexGrow: 2.6, scale: 1.05, y: 0, opacity: 1, duration: 0.55, ease: "power3.out" });
      gsap.to(small, { flexGrow: 0.7, scale: 0.68, y: -20, opacity: 0.9, duration: 0.55, ease: "power3.out" });
    }

    return () => gsap.killTweensOf([a, b]);
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
