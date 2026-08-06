"use client";

import { useEffect, useRef, useState, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import type { RootAnalysis } from "@/lib/rca";

// All stops live on ONE big canvas; the camera flies between them. Coordinates
// are virtual "world" px; the camera maps the focused stop to screen centre.
const BASEX = 520;
const BASEY = 360;
const GAPY = 660; // vertical distance between stops
const AMP = 130; // horizontal zig-zag so the route reads like a map

const pos = (i: number) => ({ x: BASEX + (i % 2 === 0 ? -AMP : AMP), y: BASEY + i * GAPY });

function vp() {
  if (typeof window === "undefined") return { w: 390, h: 780 };
  return { w: window.innerWidth, h: window.innerHeight };
}

/**
 * "Find the Root" — one continuous map. Each tap flies the camera from the
 * current stop to the next. The last stop (the root) holds the full answer +
 * actions inline, so the whole thing lives on one zoom screen (no separate
 * reveal page): 3 taps from the dashboard — symptom → factor → root.
 */
export function RootJourney({
  analysis,
  onClose,
}: {
  analysis: RootAnalysis;
  onClose: () => void;
}) {
  const nodes = analysis.nodes; // symptom, factor, root
  const lastIndex = nodes.length - 1;
  const root = nodes[lastIndex];

  const [level, setLevel] = useState(0);
  const [dims, setDims] = useState(vp);
  // Once the camera lands on the root, show the answer as a scrollable panel
  // (the map canvas is clipped + non-scrollable, which made the CTA unreachable
  // on phones). The panel guarantees the content + button are always tappable.
  const [revealed, setRevealed] = useState(false);
  const lock = useRef(false);

  const focus = (p: { x: number; y: number }, s: number, w = dims.w, h = dims.h) =>
    `translate(${w / 2 - s * p.x}px, ${h / 2 - s * p.y}px) scale(${s})`;

  const [cam, setCam] = useState(() => {
    const { w, h } = vp();
    return { t: focus(pos(0), 1, w, h), ms: 0, ease: "ease" };
  });

  // Keep the focused stop centred on resize.
  useEffect(() => {
    const onResize = () => {
      const d = vp();
      setDims(d);
      setCam({ t: focus(pos(level), 1, d.w, d.h), ms: 0, ease: "ease" });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  function travel(from: number, to: number) {
    const a = pos(from);
    const b = pos(to);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    setCam({ t: focus(mid, 0.5), ms: 460, ease: "cubic-bezier(0.6, 0, 0.85, 0.4)" });
    setLevel(to);
    window.setTimeout(
      () => setCam({ t: focus(b, 1), ms: 560, ease: "cubic-bezier(0.2, 0.7, 0.3, 1)" }),
      430,
    );
    if (to === lastIndex) window.setTimeout(() => setRevealed(true), 1000);
  }

  function go() {
    if (lock.current || level >= lastIndex) return; // root is the last stop
    lock.current = true;
    travel(level, level + 1);
    window.setTimeout(() => {
      lock.current = false;
    }, 1000);
  }

  function onWheel(e: WheelEvent) {
    if (e.deltaY > 8) go();
  }

  if (typeof document === "undefined") return null;

  const svgH = BASEY + lastIndex * GAPY + 600;

  return createPortal(
    <div
      onClick={go}
      onWheel={onWheel}
      className="fixed inset-x-0 top-0 z-[60] h-[100dvh] select-none overflow-hidden text-ink"
      style={{ background: "linear-gradient(180deg, #f4f2ff 0%, #eae8ff 55%, #e1ddff 100%)" }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-ink-3 shadow-card active:scale-90"
        style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        aria-label="Close"
      >
        ✕
      </button>

      {/* ONE canvas; the camera transform flies across it. */}
      <div
        className="absolute left-0 top-0 will-change-transform"
        style={{ transform: cam.t, transformOrigin: "0 0", transition: `transform ${cam.ms}ms ${cam.ease}` }}
      >
        <svg width={1100} height={svgH} className="absolute left-0 top-0 overflow-visible">
          <path
            d={nodes.map((_, i) => `${i ? "L" : "M"} ${pos(i).x} ${pos(i).y}`).join(" ")}
            fill="none"
            stroke="rgba(124,111,255,0.35)"
            strokeWidth={3}
            strokeDasharray="2 13"
            strokeLinecap="round"
          />
        </svg>

        {/* dive stops: symptom, factor */}
        {nodes.slice(0, lastIndex).map((n, i) => (
          <div
            key={i}
            className="absolute w-[320px] -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ left: pos(i).x, top: pos(i).y }}
          >
            {i === lastIndex - 1 && (
              <span className="siren mx-auto mb-6 block h-3 w-3 rounded-full bg-bad" />
            )}
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-ink-3">
              {n.depthLabel} · {i + 1}/{nodes.length}
            </p>
            <h2 className="font-display text-[30px] font-black leading-tight text-ink">{n.title}</h2>
            <p className="mt-4 text-base leading-relaxed text-ink-2">{n.body}</p>
            {n.evidence && <p className="mt-4 text-xs italic leading-relaxed text-ink-3">{n.evidence}</p>}
          </div>
        ))}

        {/* final stop: a light marker the camera lands on (full answer is the
            scrollable panel below). */}
        <div
          className="absolute w-[300px] -translate-x-1/2 -translate-y-1/2 text-center"
          style={{ left: pos(lastIndex).x, top: pos(lastIndex).y }}
        >
          <p className="text-5xl">🌱</p>
          <h2 className="mt-2 font-display text-[26px] font-black leading-tight text-brand">We found the root!</h2>
        </div>
      </div>

      {level < lastIndex && (
        <div className="mascot-float pointer-events-none absolute bottom-10 left-0 right-0 text-center text-sm font-semibold text-ink-3">
          {level >= lastIndex - 1 ? "tap to reveal the root ↓" : "tap to travel deeper ↓"}
        </div>
      )}

      {/* The root answer as a reachable, scrollable panel (fixes the unreachable
          CTA on phones). Stops taps from bubbling to the map's onClick. */}
      {revealed && (
        <div
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          className="screen-enter absolute inset-0 z-[62] overflow-y-auto text-ink"
          style={{ background: "linear-gradient(180deg, #f4f2ff 0%, #eae8ff 60%, #e1ddff 100%)" }}
        >
          <div
            className="mx-auto w-full max-w-md px-6 pb-10"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 32px)" }}
          >
            <p className="text-center text-5xl">🌱</p>
            <h2 className="mt-3 text-center font-display text-[26px] font-black leading-tight text-brand">
              We found the root!
            </h2>
            <p className="mt-3 text-center text-sm leading-relaxed text-ink-2">{root.body}</p>
            {root.evidence && (
              <p className="mt-2 text-center text-xs italic leading-relaxed text-ink-3">{root.evidence}</p>
            )}

            <p className="mt-6 text-xs font-bold uppercase tracking-wide text-brand">💡 Do this today</p>
            <div className="mt-2 space-y-2">
              {analysis.actions.map((a, i) => (
                <div key={i} className="flex gap-3 rounded-2xl bg-white p-3.5 shadow-card">
                  <span className="font-display text-sm font-black text-brand">{i + 1}</span>
                  <p className="text-sm leading-relaxed text-ink-2">{a}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl bg-lav-soft p-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-3">Why it&apos;s worth it</p>
              <p className="text-sm leading-relaxed text-ink-2">{analysis.payoff}</p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="mt-6 w-full rounded-2xl bg-brand py-3.5 font-display text-sm font-black text-white active:scale-[0.98]"
            >
              Back to my dashboard
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
