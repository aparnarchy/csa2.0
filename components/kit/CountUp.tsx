"use client";

import { useEffect, useRef, useState } from "react";

/** Animated count-up to `target`, re-runs when target changes. */
export function CountUp({
  target,
  decimals = 1,
  delay = 200,
  duration = 900,
}: {
  target: number;
  decimals?: number;
  delay?: number;
  duration?: number;
}) {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    let start: number | null = null;
    const startTimer = setTimeout(() => {
      const tick = (now: number) => {
        if (start === null) start = now;
        const p = Math.min((now - start) / duration, 1);
        setVal(target * p);
        if (p < 1) raf.current = requestAnimationFrame(tick);
        else setVal(target);
      };
      raf.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(startTimer);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, delay, duration]);

  return <>{val.toFixed(decimals)}</>;
}
