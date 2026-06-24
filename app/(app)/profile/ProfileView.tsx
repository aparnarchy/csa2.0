"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, ScreenShell } from "@/components/kit";
import type { Persona, SessionUser, ThemeMode } from "@/lib/types";

const PERSONAS: { key: Persona; name: string; tagline: string; emoji: string }[] = [
  { key: "spiderman", name: "Spiderman", tagline: "Warm, witty, friendly-neighbourhood pep talks.", emoji: "🕷️" },
  { key: "batman", name: "Batman", tagline: "Brooding, disciplined, no-nonsense resolve.", emoji: "🦇" },
];

/** Profile + the look & feel switcher (mode = design, persona = voice). */
export function ProfileView({ session }: { session: SessionUser }) {
  const router = useRouter();
  const [mode, setMode] = useState<ThemeMode>(session.themeMode);
  const [persona, setPersona] = useState<Persona>(session.persona);
  const [saving, setSaving] = useState(false);

  // Persist + refresh so server components (the dashboard) pick up the change
  // immediately, even mid-session.
  async function save(next: { themeMode: ThemeMode; persona: Persona }) {
    setMode(next.themeMode);
    setPersona(next.persona);
    setSaving(true);
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    router.refresh();
    setSaving(false);
  }

  return (
    <ScreenShell title="Profile" active="profile">
      <Card>
        <p className="font-display text-lg font-black text-ink">{session.name}</p>
        <p className="text-sm text-ink-3">{session.email}</p>
      </Card>

      <Card>
        <p className="text-sm font-bold text-brand">Appearance</p>
        <p className="mt-0.5 text-xs text-ink-3">
          Switch any time — the change applies right away.
        </p>

        {/* Mode = design only */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {([
            { key: "professional", label: "Professional", sub: "Clean & serious" },
            { key: "play", label: "Play", sub: "Fun & playful" },
          ] as const).map((m) => {
            const sel = mode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                disabled={saving}
                onClick={() => save({ themeMode: m.key, persona })}
                className={`rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                  sel ? "border-brand bg-lav-soft" : "border-gray-200 bg-white"
                }`}
              >
                <span className={`block font-display text-sm font-black ${sel ? "text-brand" : "text-ink"}`}>
                  {m.label}
                </span>
                <span className="mt-0.5 block text-[11px] text-ink-3">{m.sub}</span>
              </button>
            );
          })}
        </div>

        {/* Persona = voice, only relevant under Play */}
        {mode === "play" && (
          <div className="screen-enter mt-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-3">Character voice</p>
            <div className="mt-2 space-y-2">
              {PERSONAS.map((p) => {
                const sel = persona === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    disabled={saving}
                    onClick={() => save({ themeMode: "play", persona: p.key })}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                      sel ? "border-brand bg-lav-soft" : "border-gray-200 bg-white"
                    }`}
                  >
                    <span className="text-2xl leading-none" aria-hidden>{p.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-display text-sm font-black ${sel ? "text-brand" : "text-ink"}`}>
                        {p.name}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-3">{p.tagline}</span>
                    </span>
                    {sel && <span className="text-brand" aria-hidden>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </ScreenShell>
  );
}
