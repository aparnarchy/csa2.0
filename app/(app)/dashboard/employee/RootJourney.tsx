"use client";

import { useEffect, useRef, useState, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import type { RootAnalysis } from "@/lib/rca";

// All stops live on ONE big canvas; the camera flies between them. Coordinates
// are virtual "world" px; the camera maps the focused stop to screen centre.
const BASEX = 520;
const BASEY = 360;
const GAPY = 640; // vertical distance between stops
const AMP = 130; // horizontal zig-zag so the route reads like a map

const pos = (i: number) => ({ x: BASEX + (i % 2 === 0 ? -AMP : AMP), y: BASEY + i * GAPY });

function vp() {
  if (typeof window === "undefined") return { w: 390, h: 780 };
  return { w: window.innerWidth, h: window.innerHeight };
}

/**
 * "Find the Root" — one continuous map. Each tap flies the camera from the
 * current stop to the next (zoom out, travel, zoom in), so it never feels like
 * separate screens. The last stop is a subtle red root with a wide siren pulse;
 * tapping it blooms open the answer.
 */
export function RootJourney({
  analysis,
  onClose,
}: {
  analysis: RootAnalysis;
  onClose: () => void;
}) {
  const nodes = analysis.nodes;
  const lastIndex = nodes.length - 1;

  const [level, setLevel] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [dims, setDims] = useState(vp);
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
    // 1) zoom out + drift toward the next stop (you glimpse the route)
    setCam({ t: focus(mid, 0.5), ms: 460, ease: "cubic-bezier(0.6, 0, 0.85, 0.4)" });
    setLevel(to);
    // 2) zoom into the next stop
    window.setTimeout(
      () => setCam({ t: focus(b, 1), ms: 560, ease: "cubic-bezier(0.2, 0.7, 0.3, 1)" }),
      430,
    );
  }

  function go() {
    if (revealed || lock.current) return;
    if (level < lastIndex) {
      lock.current = true;
      travel(level, level + 1);
      window.setTimeout(() => {
        lock.current = false;
      }, 1000);
    } else {
      setRevealed(true);
    }
  }

  function onWheel(e: WheelEvent) {
    if (e.deltaY > 8) go();
  }

  if (typeof document === "undefined") return null;

  const svgH = BASEY + lastIndex * GAPY + 400;

  return createPortal(
    <div
      onClick={go}
      onWheel={onWheel}
      className="fixed inset-x-0 top-0 z-[60] h-[100dvh] select-none overflow-hidden text-white"
      style={{ background: "linear-gradient(180deg, #211746 0%, #130C32 55%, #090619 100%)" }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white/80 active:scale-90"
        style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        aria-label="Close"
      >
        ✕
      </button>

      {!revealed && (
        <>
          {/* ONE canvas; the camera transform flies across it. */}
          <div
            className="absolute left-0 top-0 will-change-transform"
            style={{ transform: cam.t, transformOrigin: "0 0", transition: `transform ${cam.ms}ms ${cam.ease}` }}
          >
            <svg width={1100} height={svgH} className="absolute left-0 top-0 overflow-visible">
              <path
                d={nodes.map((_, i) => `${i ? "L" : "M"} ${pos(i).x} ${pos(i).y}`).join(" ")}
                fill="none"
                stroke="rgba(179,136,255,0.4)"
                strokeWidth={3}
                strokeDasharray="2 13"
                strokeLinecap="round"
              />
            </svg>

            {nodes.map((n, i) => (
              <div
                key={i}
                className="absolute w-[320px] -translate-x-1/2 -translate-y-1/2 text-center"
                style={{ left: pos(i).x, top: pos(i).y }}
              >
                {n.isRoot && <span className="siren mx-auto mb-6 block h-3 w-3 rounded-full bg-red-400/90" />}
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
                  {n.depthLabel} · {i + 1}/{nodes.length}
                </p>
                <h2 className="font-display text-[30px] font-black leading-tight">{n.title}</h2>
                <p className="mt-4 text-base leading-relaxed text-white/80">{n.body}</p>
                {n.evidence && <p className="mt-4 text-xs italic leading-relaxed text-white/45">{n.evidence}</p>}
              </div>
            ))}
          </div>

          <div className="mascot-float pointer-events-none absolute bottom-10 left-0 right-0 text-center text-sm font-semibold text-white/55">
            {level >= lastIndex ? "tap the root to reveal ↓" : "tap to travel deeper ↓"}
          </div>
        </>
      )}

      {revealed && (
        <div
          className="bloom flex h-full flex-col overflow-y-auto px-6"
          style={{
            paddingTop: "calc(env(safe-area-inset-top) + 2.75rem)",
            paddingBottom: "calc(env(safe-area-inset-bottom) + 2.5rem)",
          }}
        >
          <p className="text-center text-5xl">🌱</p>
          <h2 className="mt-3 text-center font-display text-[26px] font-black leading-tight">We found the root!</h2>
          <p className="mx-auto mt-3 max-w-sm text-center text-[15px] leading-relaxed text-white/85">
            {nodes[lastIndex].body}
          </p>

          <div className="mx-auto mt-7 w-full max-w-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#B388FF]">💡 Do this today</p>
            <div className="space-y-2.5">
              {analysis.actions.map((a, i) => (
                <div key={i} className="flex gap-3 rounded-2xl bg-white/10 p-3.5">
                  <span className="font-display text-sm font-black text-[#B388FF]">{i + 1}</span>
                  <p className="text-[13px] leading-relaxed text-white/90">{a}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-white/5 p-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-white/45">Why it&apos;s worth it</p>
              <p className="text-[13px] leading-relaxed text-white/80">{analysis.payoff}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-7 w-full rounded-2xl bg-white py-3.5 font-display text-sm font-black text-brand active:scale-[0.98]"
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
