"use client";

import { useEffect, useRef, useState } from "react";

export type DropdownOption = [value: string, label: string];

/**
 * Rounded lavender pill dropdown used by the trend filters and the CEO/HR scope
 * picker. The trigger label wraps and truncates to 2 lines instead of forcing
 * the pill to grow past its container (that was overflowing the header row
 * when a department/team name was long) — `max-w-full` + `min-w-0` on the
 * flex parent is what makes the wrap actually take effect rather than being
 * overridden by the row's own layout.
 */
export function CustomDropdown({
  value,
  onChange,
  options,
  align = "right",
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((o) => o[0] === value)?.[1] ?? value;

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0 max-w-full flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-full items-center gap-1.5 rounded-2xl bg-lav-mid px-2.5 py-1.5 text-left text-[11px] font-bold text-brand"
      >
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <span className="flex-shrink-0 text-[9px] opacity-65">▾</span>
      </button>

      {open && (
        <div
          className={`absolute top-[calc(100%+6px)] z-50 max-h-64 w-[min(240px,80vw)] overflow-y-auto rounded-2xl bg-ink shadow-2xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map(([v, l]) => {
            const active = v === value;
            return (
              <button
                key={v}
                type="button"
                onClick={() => {
                  onChange(v);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2.5 px-4 py-2.5 text-left text-xs ${
                  active ? "bg-brand/20 font-bold text-white" : "text-white/55"
                }`}
              >
                <span className="min-w-0 flex-1 break-words">{l}</span>
                {active && <span className="flex-shrink-0 text-brand">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
