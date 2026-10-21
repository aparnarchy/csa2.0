"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Long text (e.g. a recommendation) shown as its first few lines, with a
 * "Read all" link that opens the rest in place (owner, 2026-10-21: no walls
 * of text). The link only appears when the text is actually cut off. Taps on
 * the link don't reach a parent (so a card's own tap — "next card" — still
 * works everywhere else on it).
 */
export function ClampedText({
  text,
  lines = 4,
  className = "",
  linkClassName = "",
}: {
  text: string;
  lines?: 3 | 4 | 5;
  className?: string;
  linkClassName?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (el && !open) setClipped(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);
  const clamp = { 3: "line-clamp-3", 4: "line-clamp-4", 5: "line-clamp-5" }[lines];
  return (
    <>
      <p ref={ref} className={`whitespace-pre-line ${open ? "" : clamp} ${className}`}>
        {text}
      </p>
      {(clipped || open) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={`mt-1.5 text-[12px] font-bold underline underline-offset-2 ${linkClassName}`}
        >
          {open ? "Show less" : "Read all"}
        </button>
      )}
    </>
  );
}
