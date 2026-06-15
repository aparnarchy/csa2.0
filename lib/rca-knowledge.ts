/**
 * Research-informed copy for the "Find the Root" oracle journey, keyed by pillar.
 * Tone: provocative-but-kind — name a real feeling + its downstream cost, hedged
 * ("you might…"), and always end on something hopeful and doable. NEVER blunt-doom.
 *
 * This is the deterministic stand-in for the Phase-5 AI: the AI will later return
 * this same shape personalised per user. Keep every line short and digestible.
 */
import type { PillarId } from "./types";

export interface PillarRca {
  symptom: string; // the feeling (node 0 / hook line)
  downstream: string; // the quiet consequence
  factor: string; // what's driving it (node 1, pillar-specific)
  root: string; // the underlying cause (node 2 / root)
  actions: string[]; // 2–3 concrete things to do TODAY
  payoff: string; // the emotional + career upside of acting
}

export const RCA_KNOWLEDGE: Record<PillarId, PillarRca> = {
  meaningful_work: {
    symptom: "Work might be starting to feel a little flat",
    downstream: "And flat work is the slow road to quietly checking out.",
    factor: "It's strongest around Meaningful Work — the spark in what you do day to day is fading",
    root: "Your tasks rarely connect to something you personally care about, so they feel like just 'getting through it.'",
    actions: [
      "Pick one task this week and tie it to a goal you actually care about — write the 'why' on a sticky note.",
      "Tell your manager which kind of work energises you most, and ask for one more slice of it.",
      "Tonight, note one thing that felt meaningful today — train your brain to spot it.",
    ],
    payoff: "Even one meaningful task a day rebuilds momentum. People who feel their work matters stay longer, grow faster, and do their sharpest thinking.",
  },
  growth: {
    symptom: "You might be coming to work a little bored lately",
    downstream: "And boredom quietly turns into 'what's next?' — somewhere else.",
    factor: "It's strongest around Growth — you can't quite see where this is taking you",
    root: "Your week rarely stretches you, so progress feels invisible — and invisible progress feels like standing still.",
    actions: [
      "Ask your manager for ONE stretch task this sprint — just beyond your comfort zone.",
      "Block 30 minutes this week to learn one thing tied to where you want to go.",
      "Write down the next role you'd want — naming the gap gives growth a target.",
    ],
    payoff: "A single stretch goal restarts that feeling of momentum — and momentum is what keeps work exciting and your career visibly moving.",
  },
  culture: {
    symptom: "You might be feeling a little on the outside lately",
    downstream: "And feeling unseen is exhausting, even when the work itself is fine.",
    factor: "It's strongest around Culture — connection and recognition feel thin right now",
    root: "Good work is going unnoticed and it's hard to feel fully part of the team, so showing up costs more energy than it gives back.",
    actions: [
      "Recognise a teammate openly this week — connection compounds when you start it.",
      "Share one of your own wins in your next standup or team channel; let people see it.",
      "Have one real, non-work conversation with a colleague this week.",
    ],
    payoff: "Belonging is a buffer against almost everything else. Teams that feel seen are happier, braver, and far more likely to stick together.",
  },
  compensation: {
    symptom: "Something about the deal might be feeling a bit off",
    downstream: "And feeling under-valued slowly drains how much of yourself you give.",
    factor: "It's strongest around Compensation — the value exchange feels unclear or unfair",
    root: "You're not sure your pay reflects your worth or how it compares, so effort starts to feel one-sided.",
    actions: [
      "Document your last three wins with impact and numbers — start your case file.",
      "Look up one market benchmark for your role so you know where you actually stand.",
      "Book a 1:1 about growth and pay; ask what 'next level' looks like here.",
    ],
    payoff: "Clarity changes everything. Knowing your worth — and asking for it — turns quiet resentment into a concrete plan you control.",
  },
};
