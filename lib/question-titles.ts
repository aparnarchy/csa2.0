/**
 * Short titles for recommendation cards ("6.3 | Low Score on Using Your
 * Strengths"), keyed by question id. Drafted 2026-10-14 for the owner to
 * approve; a question without one falls back to its full text.
 */
const TITLES: Record<string, string> = {
  q1: "Tackling Complex Problems",
  q2: "Connecting to a Bigger Purpose",
  q3: "Learning New Skills",
  q4: "Investment in Your Development",
  q5: "A Clear Path to Grow",
  q6: "Feeling Safe to Speak Up",
  q7: "Team Collaboration",
  q8: "Recognition for Good Work",
  q9: "Fair Pay",
  q10: "Competitive Benefits",
  q11: "Feeling Recognised",
  q12: "Recommending Us to Friends",
  q13: "Being Challenged by Your Team",
  q14: "Challenging the Group",
  q15: "Freedom in How You Work",
  q16: "Support Under Pressure",
  q17: "Being Cared About",
  q18: "Support for Your Career",
  q19: "Career Progression",
  q20: "Seeing a Path to Grow",
  q21: "Stretching Beyond Your Comfort Zone",
  q22: "Getting Meaningful Projects",
  q23: "Tackling Complex Problems",
  q24: "Using Your Strengths",
  q25: "A Sense of Accomplishment",
};

export function questionTitle(questionId: string, questionText: string): string {
  return TITLES[questionId] ?? questionText;
}
