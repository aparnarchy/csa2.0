/**
 * One tappable A/B/C answer in a questionnaire — the lettered chip plus the
 * option text, filling with brand colour when selected. Shared by the weekly
 * check-in, the catch-up flow and the career questionnaire so all three stay
 * visually identical.
 */
export function OptionCard({
  optionKey,
  text,
  selected,
  onClick,
}: {
  optionKey: string;
  text: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left text-sm font-semibold transition active:scale-[0.99] ${
        selected
          ? "border-brand bg-lav-soft text-brand shadow-card"
          : "border-transparent bg-white text-ink shadow-card"
      }`}
    >
      <span
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-black ${
          selected ? "bg-brand text-white" : "bg-lav-soft text-brand"
        }`}
      >
        {optionKey}
      </span>
      <span className="leading-snug">{text}</span>
    </button>
  );
}
