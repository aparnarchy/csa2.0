/**
 * PLACEHOLDER mascot avatar (inline SVG). The original prototype used a
 * sprite-sheet image (/mascot-sheet.png) that isn't in this project. The owner
 * will supply real mascot art in the design session — swap this file's SVG (or
 * point it at an <img>) then and every screen updates.
 */
export type AvatarExpression = "happy" | "sad" | "excited";

export function Avatar({
  expression = "happy",
  size = 64,
}: {
  expression?: AvatarExpression;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <defs>
        <linearGradient id="avatarFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9B8FFF" />
          <stop offset="100%" stopColor="#7C6FFF" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="22" fill="url(#avatarFace)" />
      {/* cheeks */}
      <circle cx="20" cy="40" r="4" fill="#FFFFFF" opacity="0.18" />
      <circle cx="44" cy="40" r="4" fill="#FFFFFF" opacity="0.18" />
      {/* eyes */}
      {expression === "happy" ? (
        <>
          <path d="M20 30 q4 -5 8 0" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M36 30 q4 -5 8 0" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M26 40 q6 6 12 0" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </>
      ) : expression === "sad" ? (
        <>
          <circle cx="24" cy="30" r="2.4" fill="#fff" />
          <circle cx="40" cy="30" r="2.4" fill="#fff" />
          <path d="M26 44 q6 -6 12 0" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx="24" cy="30" r="2.6" fill="#fff" />
          <circle cx="40" cy="30" r="2.6" fill="#fff" />
          <path d="M25 39 q7 8 14 0" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="#fff" fillOpacity="0.25" />
        </>
      )}
    </svg>
  );
}
