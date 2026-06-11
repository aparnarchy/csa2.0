"use client";

/**
 * THROWAWAY preview page (Phase 1.5 test): renders every kit component with
 * sample data on a phone-sized screen. Also smoke-tests lib/data.ts +
 * lib/scoring.ts + the access-control guards end to end. Delete before launch.
 *
 * Visit: /kit-preview
 */

import { useEffect, useState } from "react";
import {
  AIInsight,
  NotEnoughData,
  PillarCard,
  RecommendationCard,
  ScoreRing,
  ScreenShell,
  TrendChart,
} from "@/components/kit";
import {
  getEmployeeScores,
  getSampleRecommendation,
  getTeamAggregate,
  type EmployeeScores,
  type TeamAggregate,
  type Window,
} from "@/lib/data";
import type { SessionUser } from "@/lib/types";

// A fake session that is both the owner of its own scores and a manager,
// so we can exercise both the individual and team data functions here.
const FAKE_SESSION: SessionUser = {
  id: "preview-user",
  name: "Preview User",
  email: "preview@test.com",
  roles: ["employee", "manager"],
  onboardingComplete: true,
  teamId: "team-engineering",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">{title}</h2>
      {children}
    </section>
  );
}

export default function KitPreviewPage() {
  const [window, setWindow] = useState<Window>("3M");
  const [emp, setEmp] = useState<EmployeeScores | null>(null);
  const [team, setTeam] = useState<TeamAggregate | null>(null);

  useEffect(() => {
    getEmployeeScores(FAKE_SESSION, FAKE_SESSION.id, window).then(setEmp);
    getTeamAggregate(FAKE_SESSION, FAKE_SESSION.teamId!, window).then(setTeam);
  }, [window]);

  return (
    <ScreenShell title="Kit Preview" active="insights">
      <Section title="ScoreRing">
        <div className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-5">
          {emp ? (
            <ScoreRing score={emp.overall} delta={emp.delta} label="Overall" />
          ) : (
            <p className="text-sm text-gray-400">Loading…</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <ScoreRing score={3.2} delta={-0.8} label="Low" size={120} />
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <ScoreRing score={null} size={120} />
          </div>
        </div>
      </Section>

      <Section title="PillarCard (2×2 grid)">
        {emp ? (
          <div className="grid grid-cols-2 gap-3">
            {emp.pillars.map((p) => (
              <PillarCard key={p.pillarId} data={p} onClick={() => alert(p.pillarId)} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Loading…</p>
        )}
      </Section>

      <Section title="TrendChart (time + pillar filters)">
        {emp && (
          <TrendChart data={emp.trend} window={window} onWindowChange={setWindow} />
        )}
      </Section>

      <Section title="AIInsight">
        <AIInsight />
      </Section>

      <Section title="RecommendationCard">
        <RecommendationCard
          {...getSampleRecommendation("growth")}
          actionLabel="I'll try this"
          onAction={() => alert("acted")}
        />
      </Section>

      <Section title="NotEnoughData">
        <NotEnoughData />
      </Section>

      <Section title="TeamAggregate (manager view, anonymised)">
        {team?.enoughData ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-base text-gray-700">
              Team score <strong>{team.teamScore?.toFixed(1)}</strong> · participation {team.participation}% ·
              {" "}{team.reporteeCount} reportees
            </p>
          </div>
        ) : (
          <NotEnoughData message={team?.reason} />
        )}
      </Section>
    </ScreenShell>
  );
}
