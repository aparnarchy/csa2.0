"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ADMIN_NAV, BigScore, Card, CEO_NAV, GradientHeader, Mascot, ScreenShell } from "@/components/kit";
import { HEADER_MASCOT_SIZE, mascotForScore } from "@/lib/mascot";
import { COPY, fill } from "@/lib/copy";
import { giveQuestionNowAction } from "../check-in/actions";
import { TESTING_MODE } from "@/lib/testing-mode";
import type { CeoDashboard, ProfileStats } from "@/lib/data";
import type { Role, SessionUser, ThemeMode } from "@/lib/types";
import { withRetry } from "@/lib/retry";

export function ProfileView({
  session,
  stats,
  view,
  orgScore,
  orgParticipation,
  personalEmail,
}: {
  session: SessionUser;
  stats: ProfileStats;
  /** Which "hat" they're currently wearing (resolved server-side from their pick). */
  view: Role;
  /** CEO/HR only — org-wide happiness score, "dashboard style". */
  orgScore: CeoDashboard | null;
  orgParticipation: { respondedCount: number; peopleCount: number; participation: number } | null;
  /** Optional personal email the person has saved (never shown to anyone else). */
  personalEmail: string | null;
}) {
  const router = useRouter();
  const isPlay = session.themeMode === "play";
  const firstName = (session.name || "there").trim().split(/\s+/)[0];
  const isManager = session.roles.includes("manager");
  const hasCeoRole = session.roles.includes("ceo_hr");
  // CEO/HR's org-scoped profile goes with the CEO/HR VIEW: someone who also
  // manages a team and switches to Manager view gets the manager profile.
  const isCeoHr = view === "ceo_hr";
  const viewingAsEmployee = view === "employee";
  // Compose "role · company" from whatever is set; empty for a fresh account.
  const roleCompany = [stats.role, stats.company].filter(Boolean).join(" · ");
  const hasTenure = Boolean(stats.careerTenure) && stats.careerTenure !== "—";

  return (
    <ScreenShell
      active="profile"
      // Currently viewing as a plain employee (via Switch view)? Show the
      // standard employee nav (Profile/Insights/Wisdom/Inbox) — jumping back
      // to the Admin or CEO/HR nav here would silently pull them out of the
      // employee context they just switched into, which reads as broken.
      navItems={view === "admin" ? ADMIN_NAV : view === "ceo_hr" ? CEO_NAV : undefined}
    >
      {/* Header — matches the dashboard look (mascot only in Play). CEO/HR
          gets no personal stat row here — their numbers are org-wide and
          live in the dashboard-style card below, not blended into the
          header like an individual's happiness/streak/participation. */}
      {isPlay ? (
        <GradientHeader
          eyebrow={isCeoHr ? "🏢 CEO / HR" : roleCompany || undefined}
          title={session.name}
          avatar={
            <Mascot
              state={isCeoHr ? "welcome" : mascotForScore(stats.overallScore, stats.hasScore)}
              size={HEADER_MASCOT_SIZE}
              float={false}
              sparkle={false}
            />
          }
          below={isCeoHr ? undefined : <HeaderStats stats={stats} hasEmployment={session.hasEmployment} />}
        />
      ) : (
        <div
          className="rounded-card px-5 py-6"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <p className="text-xs font-semibold text-brand/70">{isCeoHr ? "🏢 CEO / HR" : roleCompany}</p>
          <h1 className="mt-1 font-display text-[30px] font-black leading-tight text-brand">{session.name}</h1>
          {!isCeoHr && (
            <div className="mt-3">
              <HeaderStats stats={stats} hasEmployment={session.hasEmployment} />
            </div>
          )}
        </div>
      )}

      {/* Demo helper — admins, testing mode only: a question right now. */}
      {TESTING_MODE && session.roles.includes("admin") && <QuestionNowButton />}

      {/* Org happiness + participation — CEO/HR only, same dashboard-style
          card (BigScore + a full-width data-confidence row) used on the Org
          dashboard and Manager dashboard, for visual consistency app-wide. */}
      {isCeoHr && orgScore && (
        <Card>
          {!orgScore.enoughData || orgScore.score === null ? (
            <p className="text-xs text-ink-3">{orgScore.reason}</p>
          ) : (
            <>
              <BigScore score={orgScore.score} caption="Org happiness" />
              {orgParticipation && (
                <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-lav-mid pt-3">
                  <OrgConfidenceDot participation={orgParticipation.participation} />
                  <span className="text-xs text-ink-3">·</span>
                  <span className="whitespace-nowrap text-xs text-ink-3">
                    {orgParticipation.respondedCount}/{orgParticipation.peopleCount} people · {orgParticipation.participation}% participation this week
                  </span>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Activity — streak + best + recent-week dots (no heatmap). Only for
          people who actually do check-ins; a manager with no employment of
          their own has no activity to show here. CEO/HR never sees this —
          their profile stays org-scoped even if they also have employment
          somewhere (e.g. the owner's own account). */}
      {session.hasEmployment && !isCeoHr && (
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-brand">{COPY.profile.activityTitle}</p>
            <span className="text-xs text-ink-3">
              {COPY.profile.bestStreak} <span className="font-bold text-brand">🔥 {stats.longestStreak}</span>
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
          <p className="mt-2 text-[11px] text-ink-4">{fill(COPY.profile.activitySummary, { weeks: stats.recentWeeks.length, total: stats.totalCheckIns })}</p>
        </Card>
      )}

      {/* Badges — not shown to CEO/HR, whose profile stays org-scoped. */}
      {!isCeoHr && (
        <Card>
          <p className="text-sm font-bold text-brand">{COPY.profile.badgesTitle}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.badges.map((b) => (
              <span key={b} className="rounded-full bg-lav-soft px-3 py-1.5 text-xs font-bold text-brand">
                🏅 {b}
              </span>
            ))}
            {stats.badges.length === 0 && <p className="text-sm text-ink-3">{COPY.profile.noBadges}</p>}
          </div>
        </Card>
      )}

      {/* Career history link → 2.8. Employee-only: a manager's own work history
          isn't part of the manager surface, so it's hidden once they hold that
          role, and CEO/HR never sees it either — org-scoped, not personal.
          Exception: currently viewing as an employee (the dashboard's view
          switcher) — that IS
          the personal surface right now, same reasoning as hasEmployment
          gating Career's own page guard. */}
      {(!isManager && !hasCeoRole) || viewingAsEmployee ? (
        <button
          type="button"
          onClick={() => router.push("/career")}
          className="flex w-full items-center justify-between rounded-card bg-white p-4 text-left shadow-card transition active:scale-[0.99]"
        >
          <div>
            <p className="text-sm font-bold text-ink">{COPY.profile.careerHistoryTitle}</p>
            <p className="mt-0.5 text-xs text-ink-3">
              {hasTenure ? fill(COPY.profile.careerTenure, { tenure: stats.careerTenure }) : COPY.profile.addWorkHistory}
            </p>
          </div>
          <span className="text-xl text-ink-4">›</span>
        </button>
      ) : null}

      {/* Appearance (Professional / Play) */}
      <AppearanceCard session={session} />

      {/* Preferences — same reasoning as Activity above: notification prefs are
          about check-in reminders, meaningless without employment (and, same
          as Activity/Badges/Career, never shown on the CEO/HR profile). */}
      {session.hasEmployment && !isCeoHr && <PreferencesCard session={session} />}

      {/* Personal email — optional, one small note, no nudging (testing phase).
          Anyone with a job record, since that's who has a work inbox to lose. */}
      {session.hasEmployment && <PersonalEmailCard initial={personalEmail} />}

      <BrandLine />

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={async () => {
            await authClient.signOut();
            router.push("/login");
          }}
          className="text-sm font-semibold text-ink-4 active:scale-95"
        >
          {COPY.profile.signOut}
        </button>
      </div>

      <p className="pb-2 text-center text-[11px] text-ink-4">{fill(COPY.profile.signedInAs, { name: firstName, email: session.email })}</p>
    </ScreenShell>
  );
}

/** "THE Culture Super" on one line in the owner's Loubag lettering (images
    cut from their Canva file, same colours as the opening animation — the
    font itself is paid, so it isn't bundled), with the tagline beneath.
    All three images share one scale, so their sizes keep Canva's ratios
    (THE 49 / Culture 100 / Super 90); "Super"'s "p" hangs below the line. */
function BrandLine() {
  const S = 0.1; // image px → screen px
  const SUPER_DESCENDER = 48; // rows below the baseline in wordmark-super.png
  return (
    <div className="flex flex-col items-center gap-3 pt-4">
      <div className="flex items-end gap-2" role="img" aria-label="The Culture Super">
        <Image src="/brand/wordmark-the.png" alt="" width={456 * S} height={116 * S} unoptimized className="mb-[3px]" />
        <Image src="/brand/wordmark-culture.png" alt="" width={1000 * S} height={259 * S} unoptimized />
        <Image
          src="/brand/wordmark-super.png"
          alt=""
          width={891 * S}
          height={266 * S}
          unoptimized
          style={{ marginBottom: -SUPER_DESCENDER * S }}
        />
      </div>
      <p className="text-center font-display text-[12px] font-semibold tracking-wide text-[#9c92ff]">
        {COPY.profile.tagline}
      </p>
    </div>
  );
}

/** Small colour-tiered dot + label — same data-confidence pattern used on the
    manager dashboard and Manager Inbox, kept consistent here too. */
function OrgConfidenceDot({ participation }: { participation: number }) {
  const color = participation >= 80 ? "#059669" : participation >= 50 ? "#B45309" : "#DC2626";
  const label = participation >= 80 ? "Strong" : participation >= 50 ? "Moderate" : "Limited";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold" style={{ color }}>
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: color }} />
      {label} data coverage
    </span>
  );
}

function HeaderStats({ stats, hasEmployment }: { stats: ProfileStats; hasEmployment: boolean }) {
  // Streak only means anything for someone who actually does check-ins —
  // same reasoning as hiding the Activity/Preferences cards below. Without
  // it this becomes a 2-up row, so it gets a bit more room to breathe rather
  // than just auto-shrinking into the same 3-up sizing.
  return (
    <div className={hasEmployment ? "flex gap-2" : "flex gap-3"}>
      <div className={`flex-1 rounded-2xl bg-white/60 text-center ${hasEmployment ? "px-3 py-2" : "px-4 py-3"}`}>
        <p
          className={`font-display text-xl font-black leading-none ${stats.hasScore ? "text-brand" : "text-ink-4/60"}`}
        >
          {stats.overallScore.toFixed(1)}
        </p>
        <p className="mt-1 text-[10px] font-semibold text-ink-3">{COPY.profile.statHappiness}</p>
      </div>
      {hasEmployment && (
        <div className="flex-1 rounded-2xl bg-white/60 px-3 py-2 text-center">
          <p className="font-display text-xl font-black leading-none text-brand">🔥 {stats.streak}</p>
          <p className="mt-1 text-[10px] font-semibold text-ink-3">{COPY.profile.statStreak}</p>
        </div>
      )}
      <div className={`flex-1 rounded-2xl bg-white/60 text-center ${hasEmployment ? "px-3 py-2" : "px-4 py-3"}`}>
        <p className="font-display text-xl font-black leading-none text-brand">{stats.participationPct}%</p>
        <p className="mt-1 text-[10px] font-semibold text-ink-3">{COPY.profile.statParticipation}</p>
      </div>
    </div>
  );
}

// ── Appearance switcher (Professional / Play = design) ───────────────────────
function AppearanceCard({ session }: { session: SessionUser }) {
  const router = useRouter();
  const [mode, setMode] = useState<ThemeMode>(session.themeMode);
  const [saving, setSaving] = useState(false);

  // The saved persona is passed back unchanged: the preferences route still
  // takes both, and nothing reads the persona any more.
  async function save(next: { themeMode: ThemeMode }) {
    setMode(next.themeMode);
    setSaving(true);
    try {
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...next, persona: session.persona }),
      });
      router.refresh();
    } catch {
      // Offline or cut off: the new look still shows on this screen; it's
      // saved next time they change it.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <p className="text-sm font-bold text-brand">{COPY.profile.appearanceTitle}</p>
      <p className="mt-0.5 text-xs text-ink-3">{COPY.profile.appearanceSub}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {([
          { key: "professional", label: COPY.profile.modeProfessional, sub: COPY.profile.modeProfessionalSub },
          { key: "play", label: COPY.profile.modePlay, sub: COPY.profile.modePlaySub },
        ] as const).map((m) => {
          const sel = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              disabled={saving}
              onClick={() => save({ themeMode: m.key })}
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
    </Card>
  );
}

// ── Personal email (optional; saved to the user's own record only) ──────────
function PersonalEmailCard({ initial }: { initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = value.trim().toLowerCase() !== saved;

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/preferences/personal-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personalEmail: value }),
    }).catch(() => null);
    if (!res) {
      setSaving(false);
      setError(COPY.shared.loadFailed);
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string; personalEmail?: string | null };
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Couldn't save. Please try again.");
      return;
    }
    setSaved(body.personalEmail ?? "");
    setValue(body.personalEmail ?? "");
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  return (
    <Card>
      <p className="text-sm font-bold text-brand">{COPY.profile.personalEmailTitle}</p>
      <p className="mt-1 text-[11px] leading-snug text-ink-3">{COPY.profile.personalEmailNote}</p>
      <div className="mt-3 flex gap-2">
        <input
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="you@gmail.com"
          className="min-w-0 flex-1 rounded-xl border border-lav-mid bg-lav-light px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="flex-shrink-0 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white active:scale-[0.98] disabled:opacity-40"
        >
          {justSaved ? COPY.profile.personalEmailSaved : COPY.profile.personalEmailSave}
        </button>
      </div>
      {error && <p className="mt-2 text-[11px] font-semibold text-red-600">{error}</p>}
    </Card>
  );
}

// ── Notification preferences (real, persisted to the user's own record) ─────
function PreferencesCard({ session }: { session: SessionUser }) {
  const router = useRouter();
  const [reminders, setReminders] = useState(session.remindersEnabled);
  const [weekly, setWeekly] = useState(session.weeklyDigestEnabled);
  const [saving, setSaving] = useState(false);

  async function save(next: { remindersEnabled: boolean; weeklyDigestEnabled: boolean }) {
    setReminders(next.remindersEnabled);
    setWeekly(next.weeklyDigestEnabled);
    setSaving(true);
    try {
      await fetch("/api/preferences/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...next, persona: session.persona }),
      });
      router.refresh();
    } catch {
      // Cut off: the toggle still shows the new value; it saves next change.
    } finally {
      setSaving(false);
    }
  }

  const rows: { label: string; desc: string; val: boolean; set: (v: boolean) => void }[] = [
    {
      label: COPY.profile.prefReminders,
      desc: COPY.profile.prefRemindersSub,
      val: reminders,
      set: (v) => save({ remindersEnabled: v, weeklyDigestEnabled: weekly }),
    },
    {
      label: COPY.profile.prefWeekly,
      desc: COPY.profile.prefWeeklySub,
      val: weekly,
      set: (v) => save({ remindersEnabled: reminders, weeklyDigestEnabled: v }),
    },
  ];

  return (
    <Card>
      <p className="text-sm font-bold text-brand">{COPY.profile.preferencesTitle}</p>
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
              disabled={saving}
              onClick={() => r.set(!r.val)}
              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition disabled:opacity-50 ${r.val ? "bg-brand" : "bg-lav-mid"}`}
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

/** Admin + testing mode: put a fresh check-in question in front of you now. */
function QuestionNowButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "none" | "failed">("idle");
  async function go() {
    setState("busy");
    try {
      const ok = await withRetry(() => giveQuestionNowAction());
      if (ok) router.push("/check-in");
      else setState("none");
    } catch {
      setState("failed");
    }
  }
  return (
    <button
      type="button"
      onClick={go}
      disabled={state === "busy"}
      className="flex w-full items-center justify-between rounded-card bg-white p-4 text-left shadow-card transition active:scale-[0.99] disabled:opacity-60"
    >
      <div>
        <p className="text-sm font-bold text-ink">{state === "busy" ? "Getting a question…" : "Give me a question now"}</p>
        <p className="mt-0.5 text-xs text-ink-3">
          {state === "none"
            ? "You've had every question this week."
            : state === "failed"
              ? "That didn't work. Try again."
              : "Testing only: answer a check-in question straight away."}
        </p>
      </div>
      <span className="text-xl text-ink-4">›</span>
    </button>
  );
}
