"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ADMIN_NAV, BackButton, Card, Modal, ScreenShell } from "@/components/kit";
import type { SessionUser, Team } from "@/lib/types";
import type { CsvImportResult, InviteInput, InviteWithMeta } from "@/lib/admin";
import {
  cancelInviteAction,
  createInviteAction,
  importInvitesCsvAction,
  resendInviteAction,
} from "../actions";

type Edit = { input: InviteInput };

const BLANK: InviteInput = { email: "", role: "employee", teamId: null };

export function InvitesView({
  session,
  initial,
  teams,
}: {
  session: SessionUser;
  initial: InviteWithMeta[];
  teams: Team[];
}) {
  const router = useRouter();
  const isPlay = session.themeMode === "play";
  const [invites, setInvites] = useState<InviteWithMeta[]>(initial);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CsvImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "pending" | "accepted">("all");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const query = search.trim().toLowerCase();
  const shown = invites.filter(
    (iv) =>
      (filter === "all" || iv.status === filter) &&
      (!query || iv.email.toLowerCase().includes(query) || (iv.name ?? "").toLowerCase().includes(query)),
  );
  const countPending = invites.filter((iv) => iv.status === "pending").length;
  const countAccepted = invites.filter((iv) => iv.status === "accepted").length;

  /** Invites are quiet, so the admin shares the signup link themselves. */
  async function copyLink(id: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/signup`);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    } catch {
      setError(`Couldn't copy — the link is ${window.location.origin}/signup`);
    }
  }

  function run(fn: () => Promise<InviteWithMeta[]>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        setInvites(await fn());
        onDone?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    });
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = ""; // allow re-picking the same file
    if (!file) return;
    setError(null);
    setSummary(null);
    startTransition(async () => {
      try {
        const text = await file.text();
        const { result, invites: fresh } = await importInvitesCsvAction(text);
        setInvites(fresh);
        setSummary(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read that file.");
      }
    });
  }

  return (
    <ScreenShell wide active="admin" navItems={ADMIN_NAV}>
      {isPlay ? (
        <div className="rounded-card bg-lav-bg px-5 py-5">
          <BackButton label="Admin" onClick={() => router.push("/dashboard/admin")} />
          <p className="text-xs font-semibold text-brand/70">✉️ Invites</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-ink">
            Invite people
          </h1>
        </div>
      ) : (
        <div
          className="rounded-card px-5 py-5"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <BackButton label="Admin" onClick={() => router.push("/dashboard/admin")} />
          <p className="text-xs font-semibold text-brand/70">✉️ Invites</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-brand">
            Invite people
          </h1>
        </div>
      )}

      {error && !edit && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setSummary(null);
            setEdit({ input: { ...BLANK } });
          }}
          className="flex-1 rounded-2xl bg-brand py-3 font-display text-sm font-black text-white active:scale-[0.98]"
        >
          + Invite someone
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="flex-1 rounded-2xl bg-lav-mid py-3 font-display text-sm font-black text-brand active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Working…" : "Upload people list"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onPickFile}
          className="hidden"
        />
      </div>
      <p className="px-1 text-[11px] leading-snug text-ink-4">
        CSV columns:{" "}
        <span className="font-semibold text-ink-3">
          email, name, team, department, grade, manager email
        </span>
        . The app works out who manages which team from the manager email, creates any missing
        teams and departments, and places people automatically when they sign up. Nobody is
        emailed — share the signup link yourself. New managers need your approval in People &amp;
        roles.
      </p>

      {/* CSV import summary */}
      {summary && (
        <Card>
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-black text-ink">Import summary</p>
            <button
              type="button"
              onClick={() => setSummary(null)}
              className="text-xs font-bold text-brand"
            >
              Dismiss
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-2">
            <span className="font-bold text-good">{summary.created} added</span>
            {" · "}
            {summary.linked !== undefined && (
              <>
                <span className="font-bold text-good">{summary.linked} already signed up</span>
                {" · "}
              </>
            )}
            <span className="font-bold text-brand">{summary.updated} refreshed</span>
            {" · "}
            <span className="font-bold text-bad">{summary.skipped} skipped</span>
          </p>
          {summary.notes && summary.notes.length > 0 && (
            <ul className="mt-2 space-y-1">
              {summary.notes.map((msg, i) => (
                <li key={i} className="text-[11px] leading-snug text-ink-2">
                  • {msg}
                </li>
              ))}
            </ul>
          )}
          {summary.errors.length > 0 && (
            <ul className="mt-2 space-y-1">
              {summary.errors.map((msg, i) => (
                <li key={i} className="text-[11px] leading-snug text-warn">
                  • {msg}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Filter toggle + search */}
      <div className="flex gap-1.5 rounded-2xl bg-white/70 p-1 shadow-card">
        {([
          { key: "all", label: `All · ${invites.length}` },
          { key: "pending", label: `Pending · ${countPending}` },
          { key: "accepted", label: `Accepted · ${countAccepted}` },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
              filter === t.key ? "bg-brand text-white shadow-sm" : "text-ink-4"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full rounded-xl border border-lav-mid bg-white px-3 py-2 text-sm text-ink placeholder-ink-4 focus:border-brand focus:outline-none"
      />

      {/* Invite table (scrolls horizontally on narrow screens) */}
      <div className="overflow-x-auto rounded-card border border-lav-mid bg-white shadow-card">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-lav-mid text-[10px] uppercase tracking-wide text-ink-3">
              <Th className="min-w-[200px]">Person</Th>
              <Th>Team</Th>
              <Th>Leads</Th>
              <Th>Grade</Th>
              <Th>Status</Th>
              <Th>Email</Th>
              <Th>Date invited</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-[11px] text-ink-4">
                  {query
                    ? "No invites match that search."
                    : `No ${filter === "all" ? "" : `${filter} `}invites yet.`}
                </td>
              </tr>
            )}
            {shown.map((iv) => (
              <tr key={iv.id} className="border-b border-lav-light/70 last:border-0">
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-ink">{iv.name || iv.email}</p>
                  {iv.name && <p className="text-[10px] text-ink-4">{iv.email}</p>}
                </td>
                <td className="px-3 py-2.5 text-ink-2">
                  {iv.teamName ?? "—"}
                  {iv.departmentName && (
                    <span className="block text-[10px] text-ink-4">{iv.departmentName}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-ink-2">{iv.leadsTeamName ?? "—"}</td>
                <td className="px-3 py-2.5 text-ink-2">{iv.grade || "—"}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={iv.status} />
                </td>
                <td className="px-3 py-2.5">
                  <EmailBadge status={iv.emailStatus} />
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">
                  {String(iv.createdAt).slice(0, 10)}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-2">
                    {iv.status === "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => copyLink(iv.id)}
                          className="whitespace-nowrap rounded-xl bg-lav-mid px-3 py-1.5 text-[11px] font-bold text-brand active:scale-[0.98]"
                        >
                          {copied === iv.id ? "Copied ✓" : "Copy link"}
                        </button>
                        <button
                          type="button"
                          onClick={() => run(() => resendInviteAction(iv.id))}
                          disabled={pending}
                          className="whitespace-nowrap rounded-xl bg-lav-mid px-3 py-1.5 text-[11px] font-bold text-brand active:scale-[0.98] disabled:opacity-50"
                        >
                          Email link
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Cancel the invite for ${iv.email}?`))
                          run(() => cancelInviteAction(iv.id));
                      }}
                      disabled={pending}
                      className="rounded-xl bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 active:scale-[0.98] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="pb-2 text-center text-[11px] text-ink-4">
        Changes are saved to the live database immediately.
      </p>

      {/* Invite editor */}
      {edit && (
        <Sheet
          title="Invite someone"
          pending={pending}
          error={error}
          onCancel={() => {
            setEdit(null);
            setError(null);
          }}
          onSave={() => run(() => createInviteAction(edit.input), () => setEdit(null))}
        >
          <Field label="Email address">
            <input
              type="email"
              value={edit.input.email}
              onChange={(e) => setEdit({ input: { ...edit.input, email: e.target.value } })}
              className={inputCls}
              placeholder="e.g. jordan@company.com"
            />
          </Field>
          <Field label="Role">
            <select
              value={edit.input.role}
              onChange={(e) =>
                setEdit({ input: { ...edit.input, role: e.target.value as InviteInput["role"] } })
              }
              className={inputCls}
            >
              <option value="employee">Individual</option>
              <option value="manager">Manager</option>
            </select>
          </Field>
          <Field label={edit.input.role === "manager" ? "Team they lead (optional)" : "Team (optional)"}>
            <select
              value={edit.input.teamId ?? ""}
              onChange={(e) => setEdit({ input: { ...edit.input, teamId: e.target.value || null } })}
              className={inputCls}
            >
              <option value="">No team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </Sheet>
      )}
    </ScreenShell>
  );
}

const inputCls =
  "mt-1 w-full rounded-xl border border-lav-mid bg-lav-light px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none";


function StatusBadge({ status }: { status: "pending" | "accepted" }) {
  const accepted = status === "accepted";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
        accepted ? "bg-green-50 text-good" : "bg-lav-soft text-brand"
      }`}
    >
      {accepted ? "Accepted" : "Pending"}
    </span>
  );
}

function EmailBadge({ status }: { status: InviteWithMeta["emailStatus"] }) {
  const style = {
    not_sent: { label: "Not emailed", cls: "bg-gray-100 text-ink-4" },
    sent: { label: "Emailed", cls: "bg-green-50 text-good" },
    failed: { label: "Didn't deliver", cls: "bg-red-50 text-red-600" },
  }[status];
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${style.cls}`}
    >
      {style.label}
    </span>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-bold ${className}`}>{children}</th>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <label className="block text-[11px] font-bold uppercase tracking-wide text-ink-3">
        {label}
      </label>
      {children}
    </div>
  );
}

function Sheet({
  title,
  children,
  onSave,
  onCancel,
  pending,
  error,
}: {
  title: string;
  children: React.ReactNode;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
        {children}
        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 rounded-2xl bg-lav-mid py-3 font-display text-sm font-black text-brand active:scale-[0.98] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="flex-1 rounded-2xl bg-brand py-3 font-display text-sm font-black text-white active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Add person"}
          </button>
        </div>
    </Modal>
  );
}
