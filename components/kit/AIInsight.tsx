"use client";

/**
 * The AI insight card, after the owner's reference design (2026-10-09): a solid
 * brand-purple rounded card with a lavender layer offset behind it, a bold
 * uppercase heading, the insight in regular-weight white text, an optional
 * small italic context line, and slowly turning white rings, large and faded,
 * in the top-right corner.
 *
 * Screens pass `text` from the server-side insight (lib/ai.ts,
 * lib/employee-facts.ts); when it's missing (below the anonymity floor, no key,
 * or the AI call failed) the fallback line renders instead — a dashboard is
 * never blocked on the AI.
 *
 * The text leads with what changed recently; an overall summary, when the
 * server sends one after SUMMARY_SEPARATOR, sits at the bottom of the card
 * (owner, 2026-10-21). `action` adds one call-to-action button.
 */
import Link from "next/link";
import { COPY } from "@/lib/copy";
import { SUMMARY_SEPARATOR } from "@/lib/recent-insight";

export function AIInsight({
  text,
  eyebrow,
  foot,
  footHref,
  action,
  loading = false,
}: {
  text?: string;
  /** The insight is still being worked out: a soft pulsing placeholder line. */
  loading?: boolean;
  /** Heading; defaults to the shared "AI insight" title. */
  eyebrow?: string;
  /** Small italic context line under the insight (never advice). */
  foot?: string;
  /** Makes the context line a link (e.g. the career-history nudge). */
  footHref?: string;
  /** One call-to-action under the insight (e.g. "Take an action"). */
  action?: { label: string; onClick: () => void };
}) {
  const [lead, summary] = splitSummary(text);
  const footClass = "mt-2 block text-[11px] italic leading-snug text-white/85";
  return (
    <div className="relative mb-3 mr-2.5">
      <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-[32px] bg-[#E3DCFF]" aria-hidden />
      <div className="relative overflow-hidden rounded-[32px] bg-brand px-5 pb-4 pt-4 text-white">
        <Orb />
        <div className="relative min-w-0 pr-10">
          <p className="font-display text-[13px] font-black uppercase leading-tight tracking-[0.02em]">
            {eyebrow ?? COPY.shared.aiInsightTitle}
          </p>
          {loading ? (
            <p className="mt-1.5 animate-pulse text-[14px] font-normal leading-[1.4] text-white/80">
              {COPY.insight.loading}
            </p>
          ) : (
            <>
              {/* The whole insight, no "More" (owner, 2026-10-28). */}
              <p className="mt-1.5 text-[14px] font-normal leading-[1.4]">{lead ?? COPY.shared.aiInsightFallback}</p>
            </>
          )}
          {!loading && summary && (
            <p className="mt-2.5 border-t border-white/20 pt-2 text-[12.5px] leading-snug text-white/90">{summary}</p>
          )}
          {!loading && foot &&
            (footHref ? (
              <Link href={footHref} className={`${footClass} underline decoration-white/50 underline-offset-2`}>
                {foot}
              </Link>
            ) : (
              <p className={footClass}>{foot}</p>
            ))}
          {!loading && action && (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-3 rounded-full bg-white px-4 py-1.5 font-display text-[12px] font-black text-brand transition active:scale-[0.97]"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The recent line and the optional overall summary after it. */
function splitSummary(text?: string): [string | undefined, string | undefined] {
  if (!text) return [undefined, undefined];
  const i = text.indexOf(SUMMARY_SEPARATOR);
  return i < 0 ? [text, undefined] : [text.slice(0, i), text.slice(i + SUMMARY_SEPARATOR.length)];
}

/** The decorative rings (styles and motion in globals.css, `.ai-orb`). */
function Orb() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="ai-orb pointer-events-none absolute right-1 top-2 h-16 w-16 opacity-30"
      aria-hidden
    >
      <circle className="ai-orb-r1" cx="50" cy="50" r="44" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeDasharray="4 14" />
      <circle className="ai-orb-r2" cx="50" cy="50" r="33" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeDasharray="90 200" />
      <circle className="ai-orb-r3" cx="50" cy="50" r="20" fill="none" stroke="#fff" strokeWidth="7" />
      <circle className="ai-orb-r4" cx="50" cy="50" r="7" fill="#fff" />
    </svg>
  );
}
