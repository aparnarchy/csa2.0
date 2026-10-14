"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface StackItem {
  /** Stable id for "seen" tracking (e.g. questionId|weekId). */
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

/**
 * Recommendations as a stack of cards (owner's reference, 2026-10-14): one
 * card on top with the next one peeking out behind it, offset down-right;
 * cards alternate light lavender and deep purple. Tap the card and it lifts
 * away while the next one rises into place. Only one recommendation is ever
 * in front of you — never a bundle. A "N new" badge counts cards not yet seen
 * on top (remembered on this device). `below` renders under the top card
 * (e.g. "Were you able to act on it?").
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
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const n = items.length;
  const i = n ? index % n : 0;
  const top = items[i];

  // Load what this person has already seen (device-local, per account).
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
    }, 600);
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

  const dark = (k: number) => k % 2 === 1;
  const nextIdx = (i + 1) % n;

  function advance() {
    if (n < 2 || leaving) return;
    setLeaving(true);
    window.setTimeout(() => {
      setIndex((x) => x + 1);
      setLeaving(false);
    }, 260);
  }

  const topDark = dark(i);
  // Behind-card colour: the next card's, or the opposite shade for a lone card.
  const backDark = n > 1 ? dark(nextIdx) : !topDark;

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

      <div className="relative mb-3 mr-2.5">
        {/* the card peeking out behind */}
        <div
          aria-hidden
          className={`absolute inset-0 translate-x-2.5 translate-y-3 rounded-[28px] ${backDark ? "bg-brand" : "bg-[#E3DCFF]"}`}
        />
        <button
          key={top.id + index}
          type="button"
          onClick={advance}
          aria-label={n > 1 ? "Show the next recommendation" : undefined}
          className={`rec-card relative block w-full rounded-[28px] px-5 py-4 text-left ${
            topDark ? "bg-brand text-white" : "bg-[#E8E2FF] text-brand"
          } ${leaving ? "rec-leave" : "rec-enter"}`}
        >
          <p className={`font-display text-[17px] font-black leading-snug ${topDark ? "text-white" : "text-brand"}`}>
            {top.score !== null ? `${top.score.toFixed(1)} | ` : ""}Low Score on {top.title}
          </p>
          <p
            className={`mt-2 whitespace-pre-line text-[14px] leading-relaxed ${
              topDark ? "text-white/90" : "text-[#5b4fd6]"
            }`}
          >
            {top.text}
          </p>
          {n > 1 && (
            <p className={`mt-3 text-[11px] font-semibold ${topDark ? "text-white/70" : "text-brand/60"}`}>
              {i + 1} of {n} · tap for the next one
            </p>
          )}
        </button>
      </div>

      {below?.(top)}
    </section>
  );
}
