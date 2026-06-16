"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { StatCircle } from "@/components/kit";

type Which = "bright" | "watch";

/**
 * The two score blobs, animated with GSAP: a muted idle zoom in/out, and a
 * click-to-expand — tap one and it grows bigger while the other shrinks up to
 * the side. Tap it again (or the other) to swap / reset.
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
      // reset to equal, then a calm (muted) idle zoom in/out on both
      gsap.to([a, b], {
        flexGrow: 1,
        scale: 1,
        y: 0,
        opacity: 1,
        duration: 0.7,
        ease: "power2.inOut",
        onComplete: () => {
          gsap.to([a, b], {
            scale: 1.018,
            duration: 2.8,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          });
        },
      });
    } else {
      const big = expanded === "bright" ? a : b;
      const small = expanded === "bright" ? b : a;
      // elegant, restrained expand: big a touch bigger, small not too small
      gsap.to(big, { flexGrow: 1.75, scale: 1.02, y: 0, opacity: 1, duration: 0.85, ease: "power2.inOut" });
      gsap.to(small, { flexGrow: 0.95, scale: 0.84, y: -10, opacity: 0.94, duration: 0.85, ease: "power2.inOut" });
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
