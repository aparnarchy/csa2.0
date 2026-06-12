/**
 * Two-or-more option pill toggle (Current Company / Overall Career,
 * Strengths / Concerns, etc.). Controlled — parent owns the value.
 */
export function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex rounded-2xl bg-lav-soft p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-xl px-2 py-2.5 text-xs font-bold transition ${
              active ? "bg-white text-brand shadow-sm" : "text-ink-4"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
