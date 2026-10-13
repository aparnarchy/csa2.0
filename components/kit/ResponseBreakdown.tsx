import { COPY, fill } from "@/lib/copy";
import type { Breakdown, ResponseOption } from "@/lib/responses";
import { SPLIT_MIN_PEOPLE } from "@/lib/scoring";

/**
 * How a question was answered, using its real option wording (lib/responses.ts):
 *  - "mine": your options with your latest pick highlighted;
 *  - "average": a small group's average + the option it's closest to, no %;
 *  - "split" (or no breakdown): the % who picked each option.
 * `score` is the question's average (yours, or the group's).
 */
export function ResponseBreakdown({
  responses,
  breakdown,
  score,
}: {
  responses: ResponseOption[];
  breakdown?: Breakdown;
  score: number;
}) {
  const t = COPY.shared;

  if (breakdown?.kind === "mine") {
    return (
      <>
        <Heading>{t.breakdownMineTitle}</Heading>
        <OptionList responses={responses} highlight={breakdown.pickedKey} tag={t.breakdownLatestTag} />
        {breakdown.timesAnswered > 1 && (
          <p className="mt-2 text-[11px] text-ink-3">
            {fill(t.breakdownAnsweredTimes, { count: breakdown.timesAnswered, avg: score.toFixed(1) })}
          </p>
        )}
      </>
    );
  }

  if (breakdown?.kind === "average") {
    const closest = responses.find((r) => r.key === breakdown.closestKey);
    return (
      <>
        <Heading>{t.breakdownAverageTitle}</Heading>
        <p className="mb-2 text-xs font-semibold text-ink-2">
          {fill(t.breakdownAverageLine, { avg: score.toFixed(1), option: closest?.text ?? "" })}
        </p>
        <OptionList responses={responses} highlight={breakdown.closestKey} />
        <p className="mt-2 text-[10px] leading-snug text-ink-4">
          {fill(t.breakdownSmallGroup, { min: SPLIT_MIN_PEOPLE })}
        </p>
      </>
    );
  }

  return (
    <>
      <Heading>{t.breakdownSplitTitle}</Heading>
      {responses.map((r) => (
        <div key={r.key} className="mb-1.5 flex items-center gap-2">
          <div className="flex-1">
            <p className="mb-0.5 text-[11px] text-ink-2">{r.text}</p>
            <div className="h-[5px] rounded-full bg-lav-soft">
              <div className="h-full rounded-full bg-brand" style={{ width: `${r.pct}%` }} />
            </div>
          </div>
          <span className="w-8 flex-shrink-0 text-right font-display text-[11px] font-bold text-brand">
            {r.pct}%
          </span>
        </div>
      ))}
    </>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wide text-ink-3">{children}</p>;
}

/** The three options, one highlighted (no percentages). */
function OptionList({
  responses,
  highlight,
  tag,
}: {
  responses: ResponseOption[];
  highlight: string | null;
  tag?: string;
}) {
  return (
    <div className="space-y-1.5">
      {responses.map((r) => {
        const on = r.key === highlight;
        return (
          <div
            key={r.key}
            className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${on ? "bg-brand text-white" : "text-ink-3"}`}
          >
            <p className="min-w-0 flex-1 text-[11px] leading-snug">{r.text}</p>
            {on && tag && (
              <span className="flex-shrink-0 rounded-md bg-white/20 px-1.5 py-0.5 text-[9px] font-bold">{tag}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
