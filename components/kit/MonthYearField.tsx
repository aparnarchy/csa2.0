"use client";

import { useState } from "react";
import { Modal } from "./Modal";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Stored value is always the 1st of the month: "YYYY-MM-01". */
const toValue = (year: number, monthIndex: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;

/**
 * A month+year picker styled to match the app (not the native OS calendar,
 * which looks inconsistent across phones and is prone to overflowing its box).
 * Renders as a tappable field; opens a small year-stepper + month-grid sheet.
 * Tapping a month selects it and closes immediately — no separate confirm step.
 */
export function MonthYearField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  /** "YYYY-MM-DD" or "" */
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [year, setYear] = useState(value ? Number(value.slice(0, 4)) : now.getFullYear());

  const selectedYear = value ? Number(value.slice(0, 4)) : null;
  const selectedMonth = value ? Number(value.slice(5, 7)) - 1 : null;
  const display = value ? `${MONTHS[selectedMonth!]} ${selectedYear}` : null;

  function pick(monthIndex: number) {
    onChange(toValue(year, monthIndex));
    setOpen(false);
  }

  return (
    <>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ink-3">{label}</span>
        <button
          type="button"
          onClick={() => {
            setYear(selectedYear ?? now.getFullYear());
            setOpen(true);
          }}
          className={`w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-left text-base focus:outline-none focus:ring-2 focus:ring-brand ${
            display ? "text-ink" : "text-ink-4"
          }`}
        >
          {display ?? placeholder}
        </button>
      </label>

      {open && (
        <Modal title={label} onClose={() => setOpen(false)}>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              aria-label="Previous year"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-lav-soft text-lg font-bold text-brand active:scale-90"
            >
              ‹
            </button>
            <span className="font-display text-lg font-black text-ink">{year}</span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              aria-label="Next year"
              disabled={year >= now.getFullYear()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-lav-soft text-lg font-bold text-brand active:scale-90 disabled:opacity-30"
            >
              ›
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {MONTHS.map((m, i) => {
              const isFuture = year === now.getFullYear() && i > now.getMonth();
              const sel = selectedYear === year && selectedMonth === i;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={isFuture}
                  onClick={() => pick(i)}
                  className={`rounded-2xl py-3 text-sm font-bold transition active:scale-[0.97] disabled:opacity-30 ${
                    sel ? "bg-brand text-white shadow-card" : "bg-lav-soft text-brand"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </>
  );
}
