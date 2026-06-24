/**
 * Persona voice layer. Under "Play" mode the user picks a character (Spiderman /
 * Batman) and the app's *dynamic* copy is re-voiced in that character — the
 * dashboard headline plus the whole Find-the-Root narrative (symptom, factor,
 * root, actions, payoff, feelings). Professional mode (no persona) keeps the
 * neutral copy in `insight.ts` / `rca-knowledge.ts`.
 *
 * This is the "personality surface": form labels and buttons stay neutral; only
 * the diagnosis/encouragement prose changes voice. Same shapes as the neutral
 * copy, so `buildEmployeeInsight` / `buildRootAnalysis` stay unchanged in shape.
 */
import type { Persona, PillarId } from "./types";
import type { PillarRca } from "./rca-knowledge";

/** Which way the score moved this period — drives the hero headline. */
export type Trend = "up" | "down" | "steady";

interface PersonaVoice {
  headline: Record<Trend, string>;
  rca: Record<PillarId, PillarRca>;
}

const SPIDERMAN: PersonaVoice = {
  headline: {
    up: "Swinging high this week",
    down: "Every hero hits a rough patch",
    steady: "Holding the line, friendly neighbour",
  },
  rca: {
    meaningful_work: {
      symptom: "Patrols are starting to feel like just going through the motions",
      downstream: "And going through the motions is how a hero loses the thrill of the swing.",
      factor: "It's strongest around Meaningful Work — the 'why' behind your day is going quiet",
      root: "Your tasks rarely connect to something you actually care about, so they feel like chores instead of a calling.",
      actions: [
        "Pick one task this week and tie it to something you genuinely care about — that's your 'with great power' moment.",
        "Tell your manager which kind of work makes you feel like you, and ask for one more slice.",
        "Tonight, jot one thing that actually mattered today — train your spider-sense for meaning.",
      ],
      payoff: "Even one meaningful task a day brings back the thrill. Heroes who believe in the mission swing further and never burn out.",
      feelings: ["Flat", "Going through the motions", "Off the swing"],
    },
    growth: {
      symptom: "You might be itching for a bigger swing lately",
      downstream: "And boredom is how a hero starts eyeing the next rooftop — somewhere else.",
      factor: "It's strongest around Growth — you can't quite see where this is taking you",
      root: "Your week rarely stretches you, so progress feels invisible — and standing still drives a hero up a wall.",
      actions: [
        "Ask your manager for ONE stretch task this sprint — something just past your reach.",
        "Block 30 minutes to learn one thing tied to where you're headed.",
        "Write down the next role you want — name the rooftop you're aiming for.",
      ],
      payoff: "One real stretch brings the thrill back. Momentum is what keeps a hero swinging forward.",
      feelings: ["Bored", "Restless", "Itching for action"],
    },
    culture: {
      symptom: "You might be feeling a bit like you're patrolling solo lately",
      downstream: "And going unseen wears you down, even when the work itself is fine.",
      factor: "It's strongest around Culture — connection and recognition feel thin right now",
      root: "Good work is going unnoticed and the team doesn't quite feel like your team, so showing up costs more than it gives back.",
      actions: [
        "Hype up a teammate openly this week — friendly neighbours start with you.",
        "Share one of your own wins in standup; let people actually see it.",
        "Have one real, non-work chat with a colleague — that's how a team becomes a crew.",
      ],
      payoff: "Belonging is a hero's safety net. Crews that feel seen are braver, happier, and stick together.",
      feelings: ["On the outside", "Unseen", "Patrolling solo"],
    },
    compensation: {
      symptom: "Something about the deal might be feeling a little off lately",
      downstream: "And feeling under-valued slowly drains how much of yourself you give.",
      factor: "It's strongest around Compensation — the trade feels unclear or unfair",
      root: "You're not sure your pay matches your worth or how it stacks up, so the effort starts to feel one-sided.",
      actions: [
        "Log your last three wins with real impact — start your case file.",
        "Look up one market benchmark for your role so you know where you stand.",
        "Book a 1:1 about pay and growth; ask what 'next level' looks like here.",
      ],
      payoff: "Clarity changes the game. Knowing your worth — and asking — turns quiet resentment into a plan you control.",
      feelings: ["Under-valued", "Second-guessing", "Holding back"],
    },
  },
};

const BATMAN: PersonaVoice = {
  headline: {
    up: "The city's a little safer tonight",
    down: "Even Gotham has its dark nights",
    steady: "Holding the line. Stay vigilant",
  },
  rca: {
    meaningful_work: {
      symptom: "The work has started to feel like routine patrol",
      downstream: "And routine, unquestioned, is how purpose quietly dies.",
      factor: "It's strongest around Meaningful Work — the reason behind the mission has gone dim",
      root: "Your tasks rarely connect to anything you truly believe in, so they feel like duty without meaning.",
      actions: [
        "Take one task this week and tie it to something you actually believe in. Purpose is a choice.",
        "Tell your manager which work matters to you. Then demand more of it.",
        "Each night, log one thing that mattered today. Discipline builds meaning.",
      ],
      payoff: "Even one meaningful act a day rebuilds resolve. Those who believe in the mission endure the longest nights.",
      feelings: ["Going through the motions", "Detached", "Running on duty"],
    },
    growth: {
      symptom: "The work has stopped testing you",
      downstream: "And a mind that isn't tested gets restless — then it leaves.",
      factor: "It's strongest around Growth — the path forward has gone dark",
      root: "Your week rarely pushes your limits, so progress is invisible — and invisible progress feels like standing still in the dark.",
      actions: [
        "Demand ONE task this sprint that's beyond your reach. Growth is forged under pressure.",
        "Carve out 30 minutes to train one skill that moves you toward the next level.",
        "Name the role you're hunting. A target turns drift into a mission.",
      ],
      payoff: "One real challenge reignites the drive. Those who keep training are the ones who rise.",
      feelings: ["Restless", "Caged", "Off-mission"],
    },
    culture: {
      symptom: "You've been operating alone lately",
      downstream: "And working unseen drains you, even when the mission goes well.",
      factor: "It's strongest around Culture — trust and recognition have thinned out",
      root: "Good work goes unnoticed and the team doesn't feel like allies, so every day costs more than it returns.",
      actions: [
        "Acknowledge an ally's work openly this week. Trust is built first by you.",
        "State one of your own wins plainly in the next briefing. Let it be seen.",
        "Have one real conversation off the clock. Even Batman needs a Gordon.",
      ],
      payoff: "Allies are what carry you through the worst nights. Teams that trust each other don't break.",
      feelings: ["Operating alone", "Unseen", "Guard up"],
    },
    compensation: {
      symptom: "The terms of the deal feel off",
      downstream: "And feeling undervalued slowly bleeds your effort dry.",
      factor: "It's strongest around Compensation — the exchange is unclear or unjust",
      root: "You don't know if your pay reflects your worth or how it compares, so effort starts to feel one-sided.",
      actions: [
        "Document your last three wins with hard numbers. Build the case.",
        "Find one market benchmark for your role. Know the terrain before you move.",
        "Set a 1:1 on pay and progression. Ask exactly what 'next level' demands.",
      ],
      payoff: "Information is leverage. Knowing your worth turns quiet resentment into a plan you command.",
      feelings: ["Undervalued", "Second-guessing", "Holding back"],
    },
  },
};

const VOICES: Record<Persona, PersonaVoice> = {
  spiderman: SPIDERMAN,
  batman: BATMAN,
};

/** The persona's hero headline for this period's trend. */
export function voicedHeadline(persona: Persona, trend: Trend): string {
  return VOICES[persona].headline[trend];
}

/** The persona's full root-cause narrative for a pillar (same shape as neutral). */
export function voicedRca(persona: Persona, pillarId: PillarId): PillarRca {
  return VOICES[persona].rca[pillarId];
}
