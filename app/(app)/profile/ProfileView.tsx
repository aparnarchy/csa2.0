"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Card, GradientHeader, Mascot, ScreenShell } from "@/components/kit";
import { HEADER_MASCOT_SIZE } from "@/lib/mascot";
import type { ProfileStats } from "@/lib/data";
import type { Persona, SessionUser, ThemeMode } from "@/lib/types";

const PERSONAS: { key: Persona; name: string; tagline: string; emoji: string }[] = [
  { key: "spiderman", name: "Spiderman", tagline: "Warm, witty, friendly-neighbourhood pep talks.", emoji: "🕷️" },
  { key: "batman", name: "Batman", tagline: "Brooding, disciplined, no-nonsense resolve.", emoji: "🦇" },
];

export function ProfileView({ session, stats }: { session: SessionUser; stats: ProfileStats }) {
  const router = useRouter();
  const isPlay = session.themeMode === "play";
  const firstName = (session.name || "there").trim().split(/\s+/)[0];
  const isManager = session.roles.includes("manager");
  // Compose "role · company" from whatever is set; empty for a fresh account.
  const roleCompany = [stats.role, stats.company].filter(Boolean).join(" · ");
  const hasTenure = Boolean(stats.careerTenure) && stats.careerTenure !== "—";

  return (
    <ScreenShell active="profile">
      {/* Header — matches the dashboard look (mascot only in Play). */}
      {isPlay ? (
        <GradientHeader
          eyebrow={roleCompany || undefined}
          title={session.name}
          avatar={<Mascot state="happy" size={HEADER_MASCOT_SIZE} float={false} sparkle={false} />}
        >
          <HeaderStats stats={stats} />
        </GradientHeader>
      ) : (
        <div
          className="rounded-card px-5 py-6"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          {roleCompany && <p className="text-xs font-semibold text-brand/70">{roleCompany}</p>}
          <h1 className="mt-1 font-display text-[30px] font-black leading-tight text-brand">{session.name}</h1>
          <div className="mt-3">
            <HeaderStats stats={stats} />
          </div>
        </div>
      )}

      {/* Activity — streak + best + recent-week dots (no heatmap) */}
      <Card>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-brand">Activity</p>
          <span className="text-xs text-ink-3">
            Best streak <span className="font-bold text-brand">🔥 {stats.longestStreak}</span>
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          {stats.recentWeeks.map((on, i) => (
            <span
              key={i}
              className={`h-3 flex-1 rounded-full ${on ? "bg-brand" : "bg-lav-mid"}`}
              title={on ? "Checked in" : "Missed"}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-4">Last {stats.recentWeeks.length} weeks · {stats.totalCheckIns} check-ins total</p>
      </Card>

      {/* Badges */}
      <Card>
        <p className="text-sm font-bold text-brand">Badges</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {stats.badges.map((b) => (
            <span key={b} className="rounded-full bg-lav-soft px-3 py-1.5 text-xs font-bold text-brand">
              🏅 {b}
            </span>
          ))}
          {stats.badges.length === 0 && <p className="text-sm text-ink-3">No badges yet — earn them in Wisdom.</p>}
        </div>
      </Card>

      {/* Career history link → 2.8 */}
      <button
        type="button"
        onClick={() => router.push("/career")}
        className="flex w-full items-center justify-between rounded-card bg-white p-4 text-left shadow-card transition active:scale-[0.99]"
      >
        <div>
          <p className="text-sm font-bold text-ink">Career history</p>
          <p className="mt-0.5 text-xs text-ink-3">
            {hasTenure ? `Total tenure: ${stats.careerTenure}` : "Add your work history"}
          </p>
        </div>
        <span className="text-xl text-ink-4">›</span>
      </button>

      {/* Appearance (mode + persona) */}
      <AppearanceCard session={session} />

      {/* Preferences */}
      <PreferencesCard />

      {/* Switch view — only if also a manager */}
      {isManager && (
        <button
          type="button"
          onClick={() => router.push("/dashboard/manager")}
          className="flex w-full items-center justify-between rounded-card bg-white p-4 text-left shadow-card transition active:scale-[0.99]"
        >
          <div>
            <p className="text-sm font-bold text-ink">Switch to Manager view</p>
            <p className="mt-0.5 text-xs text-ink-3">See your team&apos;s insights</p>
          </div>
          <span className="text-xl text-ink-4">›</span>
        </button>
      )}

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={async () => {
            await authClient.signOut();
            router.push("/login");
          }}
          className="text-sm font-semibold text-ink-4 active:scale-95"
        >
          Sign out
        </button>
      </div>

      <p className="pb-2 text-center text-[11px] text-ink-4">Signed in as {firstName} · {session.email}</p>
    </ScreenShell>
  );
}

function HeaderStats({ stats }: { stats: ProfileStats }) {
  return (
    <div className="flex gap-2">
      <div className="flex-1 rounded-2xl bg-white/60 px-3 py-2 text-center">
        <p className="font-display text-xl font-black leading-none text-brand">{stats.overallScore.toFixed(1)}</p>
        <p className="mt-1 text-[10px] font-semibold text-ink-3">happiness</p>
      </div>
      <div className="flex-1 rounded-2xl bg-white/60 px-3 py-2 text-center">
        <p className="font-display text-xl font-black leading-none text-brand">🔥 {stats.streak}</p>
        <p className="mt-1 text-[10px] font-semibold text-ink-3">day streak</p>
      </div>
      <div className="flex-1 rounded-2xl bg-white/60 px-3 py-2 text-center">
        <p className="font-display text-xl font-black leading-none text-brand">{stats.participationPct}%</p>
        <p className="mt-1 text-[10px] font-semibold text-ink-3">participation</p>
      </div>
    </div>
  );
}

// ── Appearance switcher (mode = design, persona = voice) ─────────────────────
function AppearanceCard({ session }: { session: SessionUser }) {
  const router = useRouter();
  const [mode, setMode] = useState<ThemeMode>(session.themeMode);
  const [persona, setPersona] = useState<Persona>(session.persona);
  const [saving, setSaving] = useState(false);

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
    <Card>
      <p className="text-sm font-bold text-brand">Appearance</p>
      <p className="mt-0.5 text-xs text-ink-3">Switch any time — the change applies right away.</p>

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
              <span className={`block font-display text-sm font-black ${sel ? "text-brand" : "text-ink"}`}>{m.label}</span>
              <span className="mt-0.5 block text-[11px] text-ink-3">{m.sub}</span>
            </button>
          );
        })}
      </div>

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
                    <span className={`block font-display text-sm font-black ${sel ? "text-brand" : "text-ink"}`}>{p.name}</span>
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
  );
}

// ── Notification preferences (local sample state) ────────────────────────────
function PreferencesCard() {
  const [reminders, setReminders] = useState(true);
  const [weekly, setWeekly] = useState(true);

  const rows: { label: string; desc: string; val: boolean; set: (v: boolean) => void }[] = [
    { label: "Check-in reminders", desc: "A gentle nudge when a question is ready", val: reminders, set: setReminders },
    { label: "Weekly summary", desc: "Your insights digest every Monday", val: weekly, set: setWeekly },
  ];

  return (
    <Card>
      <p className="text-sm font-bold text-brand">Preferences</p>
      <div className="mt-3 space-y-3">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={`flex items-center justify-between ${i < rows.length - 1 ? "border-b border-gray-100 pb-3" : ""}`}
          >
            <div className="min-w-0 flex-1 pr-3">
              <p className="text-sm font-semibold text-ink">{r.label}</p>
              <p className="text-[11px] text-ink-3">{r.desc}</p>
            </div>
            <button
              type="button"
              onClick={() => r.set(!r.val)}
              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${r.val ? "bg-brand" : "bg-lav-mid"}`}
              aria-pressed={r.val}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${r.val ? "left-[22px]" : "left-0.5"}`}
              />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
