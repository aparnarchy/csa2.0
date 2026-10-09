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
 */
import Link from "next/link";
import { COPY } from "@/lib/copy";

export function AIInsight({
  text,
  eyebrow,
  foot,
  footHref,
}: {
  text?: string;
  /** Heading; defaults to the shared "AI insight" title. */
  eyebrow?: string;
  /** Small italic context line under the insight (never advice). */
  foot?: string;
  /** Makes the context line a link (e.g. the career-history nudge). */
  footHref?: string;
}) {
  const footClass = "mt-2.5 block text-[11px] italic leading-snug text-white/85";
  return (
    <div className="relative mb-3 mr-2.5">
      <div className="absolute inset-0 translate-x-2.5 translate-y-3 rounded-[36px] bg-[#E3DCFF]" aria-hidden />
      <div className="relative overflow-hidden rounded-[36px] bg-brand px-5 pb-[18px] pt-5 text-white">
        <Orb />
        <div className="relative min-w-0 pr-14">
          <p className="font-display text-[13px] font-black uppercase leading-tight tracking-[0.02em]">
            {eyebrow ?? COPY.shared.aiInsightTitle}
          </p>
          <p className="mt-2 text-[15px] font-normal leading-[1.45]">{text ?? COPY.shared.aiInsightFallback}</p>
          {foot &&
            (footHref ? (
              <Link href={footHref} className={`${footClass} underline decoration-white/50 underline-offset-2`}>
                {foot}
              </Link>
            ) : (
              <p className={footClass}>{foot}</p>
            ))}
        </div>
      </div>
    </div>
  );
}

/** The decorative rings (styles and motion in globals.css, `.ai-orb`). */
function Orb() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="ai-orb pointer-events-none absolute right-1.5 top-2.5 h-24 w-24 opacity-35"
      aria-hidden
    >
      <circle className="ai-orb-r1" cx="50" cy="50" r="44" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeDasharray="4 14" />
      <circle className="ai-orb-r2" cx="50" cy="50" r="33" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeDasharray="90 200" />
      <circle className="ai-orb-r3" cx="50" cy="50" r="20" fill="none" stroke="#fff" strokeWidth="7" />
      <circle className="ai-orb-r4" cx="50" cy="50" r="7" fill="#fff" />
    </svg>
  );
}
