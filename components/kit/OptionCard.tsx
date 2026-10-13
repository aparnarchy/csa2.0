/**
 * One tappable answer in a questionnaire — just the option text, filling with
 * brand colour when selected. No A/B/C letter: options are shown shuffled, so a
 * letter would be meaningless (the tag lives in the data, not on screen). Shared by the weekly
 * check-in, the catch-up flow and the career questionnaire so all three stay
 * visually identical.
 */
export function OptionCard({
  text,
  selected,
  onClick,
}: {
  text: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[3.75rem] w-full items-center rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold transition active:scale-[0.99] ${
        selected
          ? "border-brand bg-lav-soft text-brand shadow-card"
          : "border-transparent bg-white text-ink shadow-card"
      }`}
    >
      <span className="leading-snug">{text}</span>
    </button>
  );
}
