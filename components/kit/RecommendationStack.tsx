"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface StackItem {
  /** Stable id for "seen" tracking (e.g. the questionId). */
  id: string;
  title: string;
  /** The person's current score for this pillar (shown before the title). */
  score: number | null;
  text: string;
}

/** Device-local count of unseen recommendations — drives the Inbox tab dot. */
export const UNREAD_KEY = "csa-recs-unread";
const seenKey = (userKey: string) => `csa-recs-seen:${userKey}`;

function readSeen(userKey: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(seenKey(userKey)) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** How far each card behind the top one sits (px down) and shrinks. */
const PEEK_Y = 14;
const PEEK_SCALE = 0.05;
const VISIBLE_BEHIND = 2;
const FLICK_MS = 420;

/**
 * Recommendations as a real deck of cards (owner's reference, 2026-10-14):
 * the top card in front, the next two layered beneath it (each a little lower
 * and smaller), alternating light lavender and deep purple. Tapping flicks the
 * top card off to the left while every card behind slides up one place in
 * the same motion; the flicked card rejoins at the back. All cards are the
 * same elements throughout (keyed by id), so movement is one continuous CSS
 * transition — nothing is re-mounted or faded in.
 *
 * Only one recommendation is ever readable at a time — never a bundle. A
 * "N new" badge counts cards not yet seen on top (remembered on this
 * device). `below` renders under the deck (e.g. "Were you able to act on it?").
 */
export function RecommendationStack({
  items,
  userKey,
  heading,
  below,
}: {
  items: StackItem[];
  userKey: string;
  heading?: string;
  below?: (item: StackItem) => ReactNode;
}) {
  const n = items.length;
  // Deck order as item indexes; order[0] is the card on top.
  const [order, setOrder] = useState<number[]>(() => items.map((_, k) => k));
  const [flicking, setFlicking] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [topHeight, setTopHeight] = useState<number | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Items can change (e.g. one is acted on): rebuild the order, keeping the
  // current top where possible.
  useEffect(() => {
    setOrder((prev) => {
      const kept = prev.filter((k) => k < n);
      const missing = items.map((_, k) => k).filter((k) => !kept.includes(k));
      return [...kept, ...missing];
    });
  }, [items, n]);

  const topIdx = order.find((k) => k !== flicking && k < n) ?? 0;
  const top = items[topIdx];

  // Measure the top card so the deck (and the cards behind it) match its height.
  useLayoutEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const measure = () => setTopHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [topIdx, n]);

  useEffect(() => setSeen(readSeen(userKey)), [userKey]);

  // The card on top counts as seen once it's been there a moment.
  useEffect(() => {
    if (!top) return;
    const t = window.setTimeout(() => {
      setSeen((prev) => {
        if (prev.has(top.id)) return prev;
        const next = new Set(prev).add(top.id);
        try {
          localStorage.setItem(seenKey(userKey), JSON.stringify([...next].slice(-200)));
        } catch {}
        return next;
      });
    }, 700);
    return () => window.clearTimeout(t);
  }, [top, userKey]);

  const unread = items.filter((it) => !seen.has(it.id)).length;
  useEffect(() => {
    try {
      localStorage.setItem(UNREAD_KEY, String(unread));
      window.dispatchEvent(new Event("csa-recs-unread"));
    } catch {}
  }, [unread]);

  if (!top) return null;

  function flick() {
    if (n < 2 || flicking !== null) return;
    const leaving = order[0];
    setFlicking(leaving);
    window.setTimeout(() => {
      setOrder((o) => [...o.slice(1), o[0]]);
      setFlicking(null);
    }, FLICK_MS);
  }

  // Position of each card in the deck, ignoring the one being flicked away.
  const settled = order.filter((k) => k !== flicking && k < n);
  const behind = Math.min(VISIBLE_BEHIND, Math.max(0, n - 1));
  const deckHeight = (topHeight ?? 0) + behind * PEEK_Y;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand">
          {heading ?? "Your recommendations"}
        </p>
        {unread > 0 && (
          <span className="rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-black text-white">{unread} new</span>
        )}
      </div>

      <div
        className="relative transition-[height] duration-300 ease-out"
        style={{ height: topHeight === null ? undefined : deckHeight }}
      >
        {items.map((it, k) => {
          const isFlicking = k === flicking;
          const depth = settled.indexOf(k); // 0 = top
          const isTop = depth === 0;
          const hidden = !isFlicking && depth > VISIBLE_BEHIND;
          const dark = k % 2 === 1;
          const transform = isFlicking
            ? "translate(-120%, -10px) rotate(-14deg)"
            : `translateY(${depth * PEEK_Y}px) scale(${1 - depth * PEEK_SCALE})`;
          return (
            <div
              key={it.id}
              ref={isTop ? topRef : undefined}
              onClick={isTop ? flick : undefined}
              role={isTop && n > 1 ? "button" : undefined}
              aria-label={isTop && n > 1 ? "Show the next recommendation" : undefined}
              aria-hidden={!isTop}
              className={`rec-deck-card absolute inset-x-0 top-0 rounded-[28px] px-5 py-4 text-left shadow-[0_10px_24px_-14px_rgba(80,60,200,0.55)] ${
                dark ? "bg-brand text-white" : "bg-[#E8E2FF] text-brand"
              } ${isTop && n > 1 ? "cursor-pointer" : ""}`}
              style={{
                transform,
                transformOrigin: "50% 100%", // shrink toward the bottom so edges peek below
                zIndex: isFlicking ? 50 : 40 - Math.max(depth, 0),
                opacity: isFlicking || hidden ? 0 : 1,
                // cards behind take the top card's height: only their edges show
                height: isTop || topHeight === null ? undefined : topHeight,
                overflow: isTop ? undefined : "hidden",
                pointerEvents: isTop ? "auto" : "none",
              }}
            >
              <div className={`transition-opacity duration-200 ${isTop || isFlicking ? "opacity-100" : "opacity-0"}`}>
                <p className={`font-display text-[17px] font-black leading-snug ${dark ? "text-white" : "text-brand"}`}>
                  {it.score !== null ? `${it.score.toFixed(1)} | ` : ""}Low Score on {it.title}
                </p>
                <p className={`mt-2 whitespace-pre-line text-[14px] leading-relaxed ${dark ? "text-white/90" : "text-[#5b4fd6]"}`}>
                  {it.text}
                </p>
                {n > 1 && (
                  <p className={`mt-3 text-[11px] font-semibold ${dark ? "text-white/70" : "text-brand/60"}`}>
                    {k + 1} of {n} · tap for the next one
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {below && <div className="mt-5">{below(top)}</div>}
    </section>
  );
}
