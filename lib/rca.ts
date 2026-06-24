/**
 * "Find the Root" engine. Deterministically turns the user's scores into an
 * oracle-style root-cause chain: weakest pillar → its weakest question → a root
 * cause and concrete actions. Same shape the Phase-5 AI will return, so the
 * journey UI never has to change when the AI is wired in.
 */
import type { Persona, PillarId } from "./types";
import type { EmployeeScores } from "./data";
import { PILLARS } from "./pillars";
import { RCA_KNOWLEDGE } from "./rca-knowledge";
import { voicedRca } from "./voice";

export interface RcaNode {
  depthLabel: string;
  title: string;
  body: string;
  evidence?: string;
  isRoot?: boolean;
}

export interface RootAnalysis {
  available: boolean;
  pillarId: PillarId | null;
  hook: { line: string; sub: string };
  feelings: string[];
  nodes: RcaNode[];
  actions: string[];
  payoff: string;
}

const UNAVAILABLE: RootAnalysis = {
  available: false,
  pillarId: null,
  hook: { line: "", sub: "" },
  feelings: [],
  nodes: [],
  actions: [],
  payoff: "",
};

export function buildRootAnalysis(data: EmployeeScores, persona?: Persona): RootAnalysis {
  if (!data.enoughData || data.overall === null) return UNAVAILABLE;

  const scored = data.pillars.filter((p) => p.score !== null);
  if (scored.length === 0) return UNAVAILABLE;

  // weakest pillar drives the diagnosis
  const weakest = scored.reduce((a, b) => ((b.score as number) < (a.score as number) ? b : a));
  const pillarId = weakest.pillarId;
  const kb = persona ? voicedRca(persona, pillarId) : RCA_KNOWLEDGE[pillarId];
  const label = PILLARS[pillarId].label;

  // its weakest question = the most specific evidence for the root
  const qs = data.questions.filter((q) => q.pillarId === pillarId);
  const weakestQ = qs.length ? qs.reduce((a, b) => (b.score < a.score ? b : a)) : null;

  const nodes: RcaNode[] = [
    { depthLabel: "The feeling", title: kb.symptom, body: kb.downstream },
    {
      depthLabel: "Where it lives",
      title: label,
      body: `${kb.factor} (scoring ${(weakest.score as number).toFixed(1)}).`,
    },
    {
      depthLabel: "The root",
      title: "Here's the root",
      body: kb.root,
      evidence: weakestQ ? `Your lowest signal: “${weakestQ.text}”` : undefined,
      isRoot: true,
    },
  ];

  return {
    available: true,
    pillarId,
    hook: { line: kb.symptom, sub: `${kb.downstream} Let's find out why.` },
    feelings: kb.feelings,
    nodes,
    actions: kb.actions,
    payoff: kb.payoff,
  };
}
