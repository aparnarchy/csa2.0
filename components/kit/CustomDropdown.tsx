"use client";

import { useEffect, useRef, useState } from "react";

export type DropdownOption = [value: string, label: string];

/** Rounded lavender pill dropdown used by the trend filters. */
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
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-lav-mid px-2.5 py-1.5 text-[11px] font-bold text-brand"
      >
        {selectedLabel}
        <span className="text-[9px] opacity-65">▾</span>
      </button>

      {open && (
        <div
          className={`absolute top-[calc(100%+6px)] z-50 min-w-[140px] overflow-hidden rounded-2xl bg-ink shadow-2xl ${
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
                <span>{l}</span>
                {active && <span className="text-brand">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
