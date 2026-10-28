"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setViewModeAction } from "@/lib/view-mode";
import { availableViews, VIEW_LABELS } from "@/lib/views";
import { keepCurrent, withRetry } from "@/lib/retry";
import { COPY } from "@/lib/copy";
import type { Role, SessionUser } from "@/lib/types";
import { Card } from "./Card";

/**
 * "Switch view" card on Profile, shown only to people who hold more than one
 * view (Admin / CEO/HR / Manager / Employee). It used to sit at the top of
 * every dashboard; the owner moved it here (2026-10-28) to keep the dashboard
 * headers clean. The server still checks every role, so this only ever
 * offers views the person holds.
 */
export function ViewSwitcher({ session, current }: { session: SessionUser; current: Role }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Role | null>(null);
  const views = availableViews(session);
  if (views.length < 2) return null;

  async function pick(v: Role) {
    if (v === current || busy) return;
    setBusy(v);
    // Even if saving the preference fails, still go — /dashboard works either way.
    await withRetry(() => setViewModeAction(v)).catch(keepCurrent);
    router.push("/dashboard");
  }

  return (
    <Card>
      <p className="text-sm font-bold text-brand">{COPY.profile.viewPickerTitle}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {views.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => pick(v)}
            aria-pressed={v === current}
            className={`rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition active:scale-[0.98] ${
              v === current ? "border-brand bg-lav-soft text-brand" : "border-lav-mid text-ink-2"
            } ${busy === v ? "opacity-60" : ""}`}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>
    </Card>
  );
}
