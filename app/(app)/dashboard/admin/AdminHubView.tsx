"use client";

import { useRouter } from "next/navigation";
import { Card, GradientHeader, Mascot, ScreenShell } from "@/components/kit";
import { HEADER_MASCOT_SIZE } from "@/lib/mascot";
import type { SessionUser } from "@/lib/types";

type Section = {
  icon: string;
  title: string;
  desc: string;
  href?: string; // present = live; absent = coming next
};

const SECTIONS: Section[] = [
  {
    icon: "📋",
    title: "Question bank",
    desc: "Add, edit and remove check-in questions and their A/B/C scoring.",
    href: "/dashboard/admin/questions",
  },
  {
    icon: "🏢",
    title: "Org structure",
    desc: "Departments, teams and assignments. CSV upload.",
  },
  {
    icon: "📚",
    title: "Wisdom content",
    desc: "Learning modules, content items, order, publishing and badge names.",
  },
  {
    icon: "✉️",
    title: "Invites",
    desc: "Invite managers and individuals; resend or cancel pending invites.",
  },
];

export function AdminHubView({ session }: { session: SessionUser }) {
  const router = useRouter();
  const isPlay = session.themeMode === "play";
  const firstName = (session.name || "there").trim().split(/\s+/)[0];

  return (
    <ScreenShell>
      {/* Header — Play: lavender + mascot; Professional: gradient, no mascot. */}
      {isPlay ? (
        <GradientHeader
          eyebrow="⚙️ Admin"
          title={`Hi ${firstName}`}
          avatar={
            <Mascot state="welcome" size={HEADER_MASCOT_SIZE} float={false} sparkle={false} />
          }
          className="flex min-h-[180px] flex-col justify-center"
        >
          <p className="mt-2 text-sm font-bold text-brand">Manage the app&apos;s content and people.</p>
        </GradientHeader>
      ) : (
        <div
          className="rounded-card px-5 py-6"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <p className="text-xs font-semibold text-brand/70">⚙️ Admin</p>
          <h1 className="mt-1 font-display text-[30px] font-black leading-tight text-brand">
            Hi {firstName}
          </h1>
          <p className="mt-2 font-display text-base font-black leading-snug text-brand-light">
            Manage the app&apos;s content and people.
          </p>
        </div>
      )}

      <div className="space-y-2.5">
        {SECTIONS.map((s) => {
          const live = !!s.href;
          return (
            <button
              key={s.title}
              type="button"
              disabled={!live}
              onClick={() => live && router.push(s.href!)}
              className={`w-full rounded-card border p-4 text-left shadow-card transition ${
                live
                  ? "border-lav-mid bg-white active:scale-[0.99]"
                  : "cursor-default border-gray-200 bg-gray-50 opacity-70"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-lav-soft text-xl">
                  {s.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-display text-base font-black leading-tight text-ink">{s.title}</p>
                    {!live && (
                      <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-3">
                        Next
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-3">{s.desc}</p>
                </div>
                {live && <span className="flex-shrink-0 text-brand-light">→</span>}
              </div>
            </button>
          );
        })}
      </div>

      <Card>
        <p className="text-[11px] leading-relaxed text-ink-3">
          Changes here write to the live database. Org structure, Wisdom content and Invites are
          being built next — Invites will go live once the email service is connected.
        </p>
      </Card>
    </ScreenShell>
  );
}
