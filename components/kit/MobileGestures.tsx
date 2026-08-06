"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const EDGE_ZONE = 20; // px from the left edge that starts a "swipe back"
const BACK_THRESHOLD = 70; // px dragged right to trigger router.back()
const MAX_VERTICAL_DRIFT = 60; // a back-swipe must stay roughly horizontal
const PULL_THRESHOLD = 70; // px pulled down (at the top of the page) to refresh
const MAX_PULL = 100; // visual cap on the pull indicator
const PULL_RESISTANCE = 0.5; // pulling feels heavier than a 1:1 drag

type Mode = "none" | "back" | "pull";

/**
 * The two standard mobile gestures the rest of the app doesn't have to think
 * about: swipe from the left edge to go back, and pull-down-at-the-top to
 * refresh. Mounted once around the whole authenticated app (app/(app)/layout)
 * — screens don't opt in individually. (Swipe-to-delete on a row is a separate,
 * per-list component: components/kit/SwipeToDelete.)
 *
 * Plain touch listeners on window, not Pointer Events — this only cares about
 * touch gestures (a mouse has no equivalent), and staying passive means it
 * never fights native scrolling.
 */
export function MobileGestures({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<{ x: number; y: number; mode: Mode } | null>(null);

  useEffect(() => {
    function onStart(e: TouchEvent) {
      if (refreshing) return;
      const t = e.touches[0];
      const mode: Mode = t.clientX <= EDGE_ZONE ? "back" : window.scrollY <= 0 ? "pull" : "none";
      start.current = { x: t.clientX, y: t.clientY, mode };
    }

    function onMove(e: TouchEvent) {
      if (!start.current || start.current.mode !== "pull") return;
      const t = e.touches[0];
      const dy = t.clientY - start.current.y;
      if (dy > 0 && window.scrollY <= 0) {
        setPull(Math.min(MAX_PULL, dy * PULL_RESISTANCE));
      } else {
        setPull(0);
      }
    }

    function onEnd(e: TouchEvent) {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;

      if (s.mode === "back") {
        if (dx > BACK_THRESHOLD && Math.abs(dy) < MAX_VERTICAL_DRIFT) router.back();
        return;
      }
      if (s.mode === "pull") {
        if (pull >= PULL_THRESHOLD) {
          setRefreshing(true);
          router.refresh();
          window.setTimeout(() => {
            setRefreshing(false);
            setPull(0);
          }, 600);
        } else {
          setPull(0);
        }
      }
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [router, refreshing, pull]);

  return (
    <>
      {(pull > 0 || refreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden bg-lav-bg text-xs font-bold text-brand transition-[height]"
          style={{ height: refreshing ? 44 : pull }}
        >
          {refreshing ? "Refreshing…" : pull >= PULL_THRESHOLD ? "Release to refresh ↓" : "Pull to refresh"}
        </div>
      )}
      {children}
    </>
  );
}
