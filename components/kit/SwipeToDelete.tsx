"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";

const REVEAL = 84; // px width of the red delete affordance
const OPEN_THRESHOLD = 40; // drag distance (px) to snap open on release
const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 6; // px before a touch counts as a drag, not a tap

/**
 * Swipe-left (or long-press) to reveal a red "Delete" action beside a row — the
 * standard mobile pattern, replacing an always-visible ✕ button. Tapping Delete
 * calls onDelete (screens typically use that to open their own confirm step,
 * rather than deleting immediately on tap).
 *
 * `touch-pan-y` lets the browser keep handling vertical page scroll natively
 * while horizontal drags are read here — no manual scroll-vs-swipe detection or
 * preventDefault needed. Children may contain their own onClick (e.g. "open
 * detail"); a genuine drag suppresses that click so swiping never mis-fires it.
 */
export function SwipeToDelete({
  children,
  onDelete,
  deleteLabel = "Delete",
}: {
  children: ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
}) {
  const [dragX, setDragX] = useState(0); // 0 = closed, -REVEAL = open
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startDragX = useRef(0);
  const moved = useRef(false);
  const suppressClick = useRef(false);
  const longPress = useRef<number | null>(null);

  function clearLongPress() {
    if (longPress.current) window.clearTimeout(longPress.current);
    longPress.current = null;
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    startX.current = e.clientX;
    startDragX.current = dragX;
    moved.current = false;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    clearLongPress();
    longPress.current = window.setTimeout(() => {
      if (!moved.current) {
        setDragX(-REVEAL);
        navigator.vibrate?.(8);
      }
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > MOVE_TOLERANCE) {
      moved.current = true;
      clearLongPress();
    }
    setDragX(Math.min(0, Math.max(-REVEAL, startDragX.current + dx)));
  }

  function endDrag() {
    setDragging(false);
    clearLongPress();
    if (moved.current) suppressClick.current = true;
    setDragX((x) => (x < -OPEN_THRESHOLD ? -REVEAL : 0));
  }

  return (
    <div className="relative overflow-hidden rounded-card">
      <button
        type="button"
        onClick={() => {
          setDragX(0);
          onDelete();
        }}
        aria-label={deleteLabel}
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-bad text-sm font-bold text-white"
        style={{ width: REVEAL }}
      >
        {deleteLabel}
      </button>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
            suppressClick.current = false;
          }
        }}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 0.22s ease",
        }}
        className="relative touch-pan-y bg-lav-bg"
      >
        {children}
      </div>
    </div>
  );
}
