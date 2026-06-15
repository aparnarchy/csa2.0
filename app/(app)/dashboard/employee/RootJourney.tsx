"use client";

import { useRef, useState, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import type { RootAnalysis } from "@/lib/rca";

/**
 * Full-screen, immersive "dive" through the root-cause chain. Only the current
 * cause is on screen; a tap (or a small scroll) plunges to the next, deeper one,
 * ending on a pulsing red root that blooms into the answer + today's actions.
 */
export function RootJourney({
  analysis,
  onClose,
}: {
  analysis: RootAnalysis;
  onClose: () => void;
}) {
  const [level, setLevel] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const lock = useRef(false);

  const nodes = analysis.nodes;
  const lastIndex = nodes.length - 1;
  const atRoot = level >= lastIndex;
  const node = nodes[level];

  function advance() {
    if (revealed) return;
    if (level < lastIndex) setLevel((l) => l + 1);
    else setRevealed(true);
  }

  function onWheel(e: WheelEvent) {
    if (lock.current || e.deltaY < 8) return;
    lock.current = true;
    advance();
    window.setTimeout(() => {
      lock.current = false;
    }, 650);
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={advance}
      onWheel={onWheel}
      className="fixed inset-0 z-[60] select-none overflow-hidden text-white"
      style={{ background: "radial-gradient(125% 80% at 50% 0%, #3A2E73 0%, #1B1340 55%, #0C0822 100%)" }}
    >
      {/* a faint shaft you're descending */}
      <div
        className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
        style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.18), transparent)" }}
      />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white/80 active:scale-90"
        aria-label="Close"
      >
        ✕
      </button>

      {!revealed ? (
        <>
          {/* depth dots */}
          <div className="absolute left-5 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
            {nodes.map((_, i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full transition-all"
                style={{
                  background: i <= level ? (i === lastIndex ? "#ef4444" : "#B388FF") : "rgba(255,255,255,0.25)",
                  transform: i === level ? "scale(1.5)" : "scale(1)",
                }}
              />
            ))}
          </div>

          <div className="flex h-full items-center justify-center px-8">
            <div key={level} className="dive-in max-w-sm text-center">
              {node.isRoot && (
                <div className="mx-auto mb-6 h-5 w-5 rounded-full bg-red-500 pulse-red" />
              )}
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
                {node.depthLabel} · {level + 1}/{nodes.length}
              </p>
              <h2 className="font-display text-[30px] font-black leading-tight">{node.title}</h2>
              <p className="mt-4 text-base leading-relaxed text-white/80">{node.body}</p>
              {node.evidence && (
                <p className="mt-4 text-xs italic leading-relaxed text-white/45">{node.evidence}</p>
              )}
            </div>
          </div>

          <div className="mascot-float absolute bottom-10 left-0 right-0 text-center text-sm font-semibold text-white/55">
            {atRoot ? "tap the root to reveal ↓" : "tap to dig deeper ↓"}
          </div>
        </>
      ) : (
        <div className="bloom flex h-full flex-col overflow-y-auto px-6 py-12">
          <p className="text-center text-5xl">🌱</p>
          <h2 className="mt-3 text-center font-display text-[26px] font-black leading-tight">
            We found the root!
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-center text-[15px] leading-relaxed text-white/85">
            {nodes[lastIndex].body}
          </p>

          <div className="mx-auto mt-7 w-full max-w-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#B388FF]">
              💡 Do this today
            </p>
            <div className="space-y-2.5">
              {analysis.actions.map((a, i) => (
                <div key={i} className="flex gap-3 rounded-2xl bg-white/10 p-3.5">
                  <span className="font-display text-sm font-black text-[#B388FF]">{i + 1}</span>
                  <p className="text-[13px] leading-relaxed text-white/90">{a}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-white/5 p-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-white/45">
                Why it&apos;s worth it
              </p>
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
