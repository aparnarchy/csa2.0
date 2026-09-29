import { PILLAR_ORDER } from "@/lib/pillars";
import { BigScore } from "./BigScore";
import { Card } from "./Card";
import { PillarCard } from "./PillarCard";

/**
 * The starting state of every dashboard (employee, team, department, company):
 * the same score card, at 0.0 in grey with 0.0 pillars, plus one line saying
 * exactly what will fill it in. No mood, no bright spot / watch out, no trend
 * — nothing that implies a score the data doesn't have.
 */
export function EmptyScoreCard({ message, caption }: { message: string; caption?: string }) {
  return (
    <Card>
      <div className="mb-4">
        <BigScore score={null} caption={caption} />
        <p className="mt-1 text-[11px] leading-snug text-ink-4">{message}</p>
      </div>
      <div className="-mx-1.5 grid grid-cols-4 gap-2">
        {PILLAR_ORDER.map((pillarId) => (
          <PillarCard
            key={pillarId}
            data={{ pillarId, score: null, delta: null, band: null, percentile: null, responseCount: 0 }}
          />
        ))}
      </div>
    </Card>
  );
}
