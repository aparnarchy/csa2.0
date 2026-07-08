"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Centered, scrollable modal dialog. Renders through a PORTAL to document.body
 * so it escapes any transformed ancestor (e.g. the `.screen-enter` page frame,
 * whose lingering `transform` would otherwise capture `position: fixed` and drop
 * the dialog to the bottom of the page, off-screen). Closes on backdrop click
 * or Escape, and locks background scroll while open. Mobile-first: full-width
 * card capped at 85% of the viewport height with its own internal scroll.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  // Lock background scroll + close on Escape while the dialog is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-card bg-white shadow-2xl"
      >
        {title && (
          <div className="flex items-center justify-between border-b border-lav-mid px-5 py-4">
            <h2 className="font-display text-lg font-black text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-2xl leading-none text-ink-4 active:scale-90"
            >
              ×
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
