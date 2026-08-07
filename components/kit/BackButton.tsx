/**
 * The app-wide "go back" affordance. Industry standard (iOS HIG / Material
 * Design) is a top-left icon button — a chevron, minimum ~40-44px tap target,
 * with enough visual weight (background + shadow) to read as tappable, not a
 * plain text link. A bare "← Label" in small text technically works but fails
 * both the tap-target size and the "looks interactive" bar.
 *
 * `label` is optional — pass it when the destination benefits from a name
 * ("Org dashboard", "All managers"); omit it for a plain icon-only back button.
 * Either way the chevron chip stays a fixed, generous tap target.
 */
export function BackButton({
  label,
  onClick,
}: {
  label?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ? `Back to ${label}` : "Back"}
      className={`mb-3 inline-flex h-10 items-center gap-2 rounded-full bg-white text-sm font-bold text-brand shadow-card transition active:scale-95 ${
        label ? "pl-2 pr-4" : "w-10 justify-center"
      }`}
    >
      <span
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-lav-soft text-lg leading-none"
        aria-hidden
      >
        ‹
      </span>
      {label}
    </button>
  );
}
