"use client";

import { useState } from "react";
import { COPY } from "@/lib/copy";
import { PILLARS, PILLAR_ORDER } from "@/lib/pillars";
import { Icon } from "./Icons";
import { Modal } from "./Modal";

/**
 * "What do the pillars mean?" — a small link under a dashboard's pillar cards
 * that opens one pop-up with all four definitions (owner, 2026-10-28; the app
 * description moved to Profile's (i) the same day). Phones have no hover, so this tap is the main way in;
 * the cards themselves still tap through to pillar detail, and on a laptop
 * hovering a card shows its definition too (PillarCard's title).
 */
export function PillarInfo({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mx-auto flex items-center gap-1.5 text-xs font-semibold text-brand/80 active:scale-95 ${className}`}
      >
        <Icon name="info" size={14} />
        {COPY.pillars.infoButton}
      </button>

      {open && (
        <Modal title={COPY.pillars.popupTitle} onClose={() => setOpen(false)}>
          <div className="space-y-4">
            {PILLAR_ORDER.map((id) => {
              const meta = PILLARS[id];
              return (
                <div key={id} className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-lav-soft text-brand">
                    <Icon name={meta.icon} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[15px] font-black text-ink">{meta.label}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">{meta.definition}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </>
  );
}
