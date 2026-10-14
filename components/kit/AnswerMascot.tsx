import type { MascotState } from "@/lib/mascot";

/**
 * The original CSA mascot, drawn as parts (body, eyes, brows, mouths, arms,
 * cheeks, hearts, tear) so its face can actually move — no third-party art.
 *
 * `mood` picks the pose: welcome (open eyes, soft smile), happy (happy-arc
 * eyes, big grin, arms up, hearts), sad (worried brows, frown, a tear), angry
 * (cross brows, narrowed eyes, flat frown).
 *
 * `play`: each new number above 0 plays the answer reaction (~0.7s) from the
 * welcome pose: blink → eyes close into happy arcs → smile opens → bounce with
 * arms up → hearts burst. Same reaction for every answer (a "thanks", never
 * "good answer"), so it can't nudge people toward positive answers.
 *
 * All motion and the per-mood visibility live in globals.css
 * (`.answer-mascot`); reduced-motion users get poses without movement.
 */
const HEARTS: { tx: number; ty: number; s: number; r: number; d: number; fill: string }[] = [
  { tx: 44, ty: 58, s: 1.25, r: -18, d: 0, fill: "#7c6fff" },
  { tx: 176, ty: 50, s: 1.45, r: 16, d: 30, fill: "#7c6fff" },
  { tx: 24, ty: 104, s: 0.85, r: 12, d: 60, fill: "#a99eff" },
  { tx: 198, ty: 104, s: 0.9, r: -14, d: 45, fill: "#a99eff" },
  { tx: 82, ty: 26, s: 0.8, r: 10, d: 90, fill: "#b9b0ff" },
  { tx: 146, ty: 22, s: 0.95, r: -10, d: 75, fill: "#9b8fff" },
];

const INK = "#2e2350";

export function MascotArt({ mood = "welcome", play = 0 }: { mood?: MascotState; play?: number }) {
  const state = play > 0 ? "am-play" : `am-${mood}`;
  return (
    // key: a fresh element per reaction restarts the CSS animation
    <svg key={play} viewBox="0 0 220 240" className={`answer-mascot ${state}`} width="100%" height="100%" overflow="visible">
      <defs>
        <linearGradient id="am-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e4deff" />
          <stop offset="1" stopColor="#bfb3ff" />
        </linearGradient>
        <path id="am-heart" d="M0 9 C -14 0 -10 -13 0 -5 C 10 -13 14 0 0 9 Z" />
      </defs>

      <ellipse cx="110" cy="222" rx="38" ry="6" fill="#7c6fff" opacity=".13" />

      {HEARTS.map((h, i) => (
        <g
          key={i}
          className="am-heart"
          style={
            { "--tx": `${h.tx}px`, "--ty": `${h.ty}px`, "--s": h.s, "--r": `${h.r}deg`, "--d": `${h.d}ms` } as React.CSSProperties
          }
        >
          <use href="#am-heart" fill={h.fill} />
        </g>
      ))}

      <g className="am-part am-body">
        <ellipse cx="93" cy="212" rx="13" ry="7" fill="#b2a6ff" />
        <ellipse cx="127" cy="212" rx="13" ry="7" fill="#b2a6ff" />
        <path className="am-part am-arm-l" d="M56 150 Q40 158 34 172" stroke="#b9adff" strokeWidth="11" strokeLinecap="round" fill="none" />
        <path className="am-part am-arm-r" d="M164 150 Q180 158 186 172" stroke="#b9adff" strokeWidth="11" strokeLinecap="round" fill="none" />
        <path d="M110 46 C 110 36 114 30 120 26" stroke="#7c6fff" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M119 27 C 128 16 142 18 146 24 C 138 32 126 33 119 27 Z" fill="#9fd3a7" />
        <path
          d="M110 44 C 128 74 172 106 172 148 C 172 186 144 208 110 208 C 76 208 48 186 48 148 C 48 106 92 74 110 44 Z"
          fill="url(#am-body)"
          stroke="#a69aff"
          strokeWidth="2"
        />
        <ellipse cx="80" cy="112" rx="9" ry="15" fill="#fff" opacity=".55" transform="rotate(28 80 112)" />
        <g className="am-cheeks" opacity=".45">
          <ellipse cx="74" cy="162" rx="10" ry="6" fill="#ff9ec4" />
          <ellipse cx="146" cy="162" rx="10" ry="6" fill="#ff9ec4" />
        </g>

        {/* eyes */}
        <g className="am-part am-eye">
          <ellipse cx="88" cy="144" rx="8.5" ry="11" fill={INK} />
          <circle cx="91" cy="139" r="3" fill="#fff" />
        </g>
        <g className="am-part am-eye">
          <ellipse cx="132" cy="144" rx="8.5" ry="11" fill={INK} />
          <circle cx="135" cy="139" r="3" fill="#fff" />
        </g>
        {/* angry: upper lids narrow the eyes */}
        <g className="am-lids">
          <path d="M77 132 L100 141 L100 128 L77 128 Z" fill="#d6cfff" />
          <path d="M143 132 L120 141 L120 128 L143 128 Z" fill="#d6cfff" />
        </g>
        <path className="am-part am-happy-eye" d="M78 147 Q88 134 98 147" stroke={INK} strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path className="am-part am-happy-eye" d="M122 147 Q132 134 142 147" stroke={INK} strokeWidth="4.5" strokeLinecap="round" fill="none" />

        {/* brows */}
        <g className="am-brows-sad">
          <path d="M78 126 Q86 122 96 127" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" transform="rotate(-12 87 125)" />
          <path d="M124 127 Q134 122 142 126" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" transform="rotate(12 133 125)" />
        </g>
        <g className="am-brows-angry">
          <path d="M76 127 L100 136" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
          <path d="M144 127 L120 136" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
        </g>

        {/* mouths */}
        <path className="am-mouth-small" d="M102 166 Q110 173 118 166" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <g className="am-part am-mouth-big">
          <path d="M94 162 Q110 190 126 162 Z" fill={INK} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx="110" cy="176" rx="8" ry="4.5" fill="#ff8fb8" />
        </g>
        <path className="am-mouth-frown" d="M100 172 Q110 163 120 172" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path className="am-mouth-cross" d="M99 171 Q110 165 121 171" stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none" />

        {/* sad: a tear */}
        <path className="am-tear" d="M84 158 C 84 158 78 167 78 171 C 78 175 81 177 84 177 C 87 177 90 175 90 171 C 90 167 84 158 84 158 Z" fill="#8fc8ff" opacity=".9" />
      </g>
    </svg>
  );
}

/** Check-in mascot: idle welcome pose that reacts each time `play` increases. */
export function AnswerMascot({ size = 198, play = 0 }: { size?: number; play?: number }) {
  return (
    <div style={{ width: size, height: (size * 240) / 220 }} aria-hidden>
      <MascotArt mood="welcome" play={play} />
    </div>
  );
}
