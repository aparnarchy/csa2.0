"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setViewModeAction } from "@/lib/view-mode";
import { availableViews, VIEW_LABELS } from "@/lib/views";
import { keepCurrent, withRetry } from "@/lib/retry";
import { COPY } from "@/lib/copy";
import type { Role, SessionUser } from "@/lib/types";

/**
 * Small "Manager view ⇄" chip for the top of a dashboard header, shown only to
 * people who hold more than one view (Admin / CEO/HR / Manager / Employee).
 * Tapping opens a short list of their views; picking one switches straight
 * there. Same choice as the Profile "Switch view" card — the server still
 * checks every role, so this only ever offers views the person holds.
 */
export function ViewSwitcher({ session, current }: { session: SessionUser; current: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const views = availableViews(session);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  if (views.length < 2) return null;

  async function pick(v: Role) {
    setOpen(false);
    if (v === current) return;
    // Even if saving the preference fails, still go — /dashboard works either way.
    await withRetry(() => setViewModeAction(v)).catch(keepCurrent);
    router.push("/dashboard");
  }

  return (
    <div ref={ref} className="relative mb-2 inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-brand shadow-sm transition active:scale-95"
      >
        {VIEW_LABELS[current]} view
        <span aria-hidden className="text-sm leading-none">⇄</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-48 rounded-2xl bg-white p-1.5 shadow-card">
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-4">
            {COPY.profile.viewPickerTitle}
          </p>
          {views.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => pick(v)}
              className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-sm font-bold transition ${
                v === current ? "bg-lav-soft text-brand" : "text-ink-2 active:bg-lav-soft"
              }`}
            >
              {VIEW_LABELS[v]}
              {v === current && <span className="text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
