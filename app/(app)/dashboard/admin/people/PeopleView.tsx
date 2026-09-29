"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { ADMIN_NAV, BackButton, Card, Modal, ScreenShell } from "@/components/kit";
import type {
  BulkResult,
  CsvImportResult,
  Directory,
  DirectoryRow,
  PersonInput,
} from "@/lib/admin";
import type { Role, SessionUser } from "@/lib/types";
import {
  addPersonAction,
  approvePendingManagerAction,
  bulkSetStatusAction,
  deletePeopleAction,
  emailInviteAction,
  importPeopleCsvAction,
  rejectPendingManagerAction,
  updatePersonAction,
} from "../actions";

const ROLE_ORDER: Role[] = ["employee", "manager", "ceo_hr", "admin"];

const ROLE_LABEL: Record<Role, string> = {
  employee: "Employee",
  manager: "Manager",
  ceo_hr: "CEO/HR",
  admin: "Admin",
};

const ROLE_HEX: Record<Role, string> = {
  employee: "#6B7280",
  manager: "#2563EB",
  ceo_hr: "#7C3AED",
  admin: "#DC2626",
};

type StatusFilter = "all" | "active" | "resigned" | "not_signed_up";

/** Editor state: `key` null = adding a new person. */
type Edit = { key: string | null; row: DirectoryRow | null; input: PersonInput };

const todayStr = () => new Date().toISOString().slice(0, 10);

const BLANK: PersonInput = {
  name: "",
  email: "",
  employeeId: "",
  teamId: null,
  departmentId: null,
  grade: "",
  status: "active",
  endedAt: null,
  roles: ["employee"],
};

export function PeopleView({
  session,
  initial,
  currentUserId,
}: {
  session: SessionUser;
  initial: Directory;
  currentUserId: string;
}) {
  const router = useRouter();
  const isPlay = session.themeMode === "play";
  const [dir, setDir] = useState<Directory>(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<Edit | null>(null);
  const [resignFor, setResignFor] = useState<{ keys: string[]; date: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string[] | null>(null);
  const [summary, setSummary] = useState<CsvImportResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dir.rows.filter((r) => {
      const statusOk =
        statusFilter === "all" ||
        (statusFilter === "not_signed_up" ? !r.signedUp : r.status === statusFilter);
      const text = [r.name, r.email, r.employeeId, r.teamName, r.departmentName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return statusOk && (q === "" || text.includes(q));
    });
  }, [dir.rows, search, statusFilter]);

  const counts = useMemo(
    () => ({
      all: dir.rows.length,
      active: dir.rows.filter((r) => r.status === "active").length,
      resigned: dir.rows.filter((r) => r.status === "resigned").length,
      not_signed_up: dir.rows.filter((r) => !r.signedUp).length,
    }),
    [dir.rows],
  );

  // Selection is scoped to what's visible — hidden rows are never acted on.
  const visibleSelected = rows.filter((r) => selected.has(r.key));
  const allVisibleSelected = rows.length > 0 && visibleSelected.length === rows.length;
  const someVisibleSelected = visibleSelected.length > 0 && !allVisibleSelected;

  function toggleAll() {
    setSelected(allVisibleSelected ? new Set() : new Set(rows.map((r) => r.key)));
  }
  function toggleOne(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  }

  function run(fn: () => Promise<Directory>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        setDir(await fn());
        onDone?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    });
  }

  function runBulk(fn: () => Promise<{ result: BulkResult; directory: Directory }>, verb: string) {
    setError(null);
    startTransition(async () => {
      try {
        const { result, directory } = await fn();
        setDir(directory);
        setSelected(new Set());
        setNotice([
          `${result.changed} ${result.changed === 1 ? "person" : "people"} ${verb}.`,
          ...result.skipped,
        ]);
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
        const { result, directory } = await importPeopleCsvAction(await file.text());
        setDir(directory);
        setSummary(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read that file.");
      }
    });
  }

  async function copyLink(key: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/signup`);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      setError(`Couldn't copy — the link is ${window.location.origin}/signup`);
    }
  }

  /** Same columns as the upload, so an export can be edited and re-uploaded. */
  function exportCsv() {
    const esc = (v: string | null | undefined) => {
      const s = v ?? "";
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      "Employee ID",
      "Email",
      "Name",
      "Team",
      "Department",
      "Grade",
      "Manager Email",
      "Status",
      "Left on",
      "Signed up",
      "Roles",
    ];
    const source = visibleSelected.length > 0 ? visibleSelected : rows;
    const lines = source.map((r) =>
      [
        r.employeeId,
        r.email,
        r.name,
        r.teamName,
        r.departmentName,
        r.grade,
        r.managerEmail,
        statusLabel(r),
        r.endedAt,
        r.signedUp ? "Yes" : "No",
        r.roles.map((x) => ROLE_LABEL[x]).join(" / "),
      ]
        .map(esc)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `people-${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openEdit(r: DirectoryRow) {
    setError(null);
    setEdit({
      key: r.key,
      row: r,
      input: {
        name: r.name === r.email ? "" : r.name,
        email: r.email,
        employeeId: r.employeeId ?? "",
        teamId: r.teamId,
        departmentId: r.departmentId,
        grade: r.grade ?? "",
        status: r.status === "resigned" ? "resigned" : "active",
        endedAt: r.endedAt,
        roles: r.roles.length ? r.roles : ["employee"],
      },
    });
  }

  function saveEdit() {
    if (!edit) return;
    const { key, input } = edit;
    run(() => (key ? updatePersonAction(key, input) : addPersonAction(input)), () => setEdit(null));
  }

  const setInput = (patch: Partial<PersonInput>) =>
    edit && setEdit({ ...edit, input: { ...edit.input, ...patch } });

  return (
    <ScreenShell wide active="admin" navItems={ADMIN_NAV}>
      {isPlay ? (
        <div className="rounded-card bg-lav-bg px-5 py-5">
          <BackButton label="Admin" onClick={() => router.push("/dashboard/admin")} />
          <p className="text-xs font-semibold text-brand/70">👥 People</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-ink">Everyone</h1>
        </div>
      ) : (
        <div
          className="rounded-card px-5 py-5"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <BackButton label="Admin" onClick={() => router.push("/dashboard/admin")} />
          <p className="text-xs font-semibold text-brand/70">👥 People</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-brand">Everyone</h1>
        </div>
      )}

      {/* Managers awaiting approval */}
      {dir.pendingManagers.length > 0 && (
        <section className="rounded-card border border-lav-mid bg-white p-4 shadow-card">
          <p className="font-display text-sm font-black text-ink">Managers waiting for approval</p>
          <p className="mt-1 text-[11px] leading-snug text-ink-3">
            Check each account is really that person before approving — sign-up doesn&apos;t
            confirm email addresses yet. Approving gives them the manager role and their team&apos;s
            dashboard.
          </p>
          <ul className="mt-3 space-y-2">
            {dir.pendingManagers.map((m) => (
              <li
                key={m.teamId}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-lav-light px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-ink">
                    {m.userName ?? m.email} <span className="font-normal text-ink-3">→ leads</span>{" "}
                    {m.teamName}
                  </p>
                  <p className="text-[10px] text-ink-4">
                    {m.email}
                    {m.signedUpAt
                      ? ` · signed up ${String(m.signedUpAt).slice(0, 10)}`
                      : " · hasn't signed up yet"}
                  </p>
                </div>
                {m.userId && (
                  <button
                    type="button"
                    onClick={() => run(() => approvePendingManagerAction(m.teamId))}
                    disabled={pending}
                    className="rounded-xl bg-brand px-3 py-1.5 text-[11px] font-bold text-white active:scale-[0.98] disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Stop ${m.email} from becoming ${m.teamName}'s manager?`))
                      run(() => rejectPendingManagerAction(m.teamId));
                  }}
                  disabled={pending}
                  className="rounded-xl bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 active:scale-[0.98] disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setEdit({ key: null, row: null, input: { ...BLANK } });
          }}
          className="flex-1 whitespace-nowrap rounded-2xl bg-brand px-4 py-3 font-display text-sm font-black text-white active:scale-[0.98]"
        >
          + Add person
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="flex-1 whitespace-nowrap rounded-2xl bg-lav-mid px-4 py-3 font-display text-sm font-black text-brand active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Working…" : "Upload people list"}
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="flex-1 whitespace-nowrap rounded-2xl bg-lav-mid px-4 py-3 font-display text-sm font-black text-brand active:scale-[0.98]"
        >
          Export CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPickFile} className="hidden" />
      </div>
      <p className="px-1 text-[11px] leading-snug text-ink-4">
        Upload columns:{" "}
        <span className="font-semibold text-ink-3">
          Employee ID, Email, Name, Team, Department, Grade, Manager Email
        </span>
        . People are matched by employee ID, then email, and updated in place — nobody is removed
        or emailed. Export gives you the same columns to edit and re-upload.
      </p>

      {error && !edit && !resignFor && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>
      )}

      {notice && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <ul className="min-w-0 flex-1 space-y-1">
              {notice.map((n, i) => (
                <li
                  key={i}
                  className={`text-[11px] leading-snug ${i === 0 ? "font-bold text-ink" : "text-warn"}`}
                >
                  {n}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setNotice(null)} className="text-xs font-bold text-brand">
              Dismiss
            </button>
          </div>
        </Card>
      )}

      {summary && (
        <Card>
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-black text-ink">Upload summary</p>
            <button type="button" onClick={() => setSummary(null)} className="text-xs font-bold text-brand">
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
            <span className="font-bold text-brand">{summary.updated} updated</span>
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

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto rounded-2xl bg-white/70 p-1 shadow-card">
        {([
          { key: "all", label: `All · ${counts.all}` },
          { key: "active", label: `Active · ${counts.active}` },
          { key: "resigned", label: `Resigned · ${counts.resigned}` },
          { key: "not_signed_up", label: `Not signed up · ${counts.not_signed_up}` },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatusFilter(t.key)}
            className={`flex-1 whitespace-nowrap rounded-xl px-2 py-2 text-xs font-bold transition ${
              statusFilter === t.key ? "bg-brand text-white shadow-sm" : "text-ink-4"
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
        placeholder="Search name, email, employee ID, team…"
        className="w-full rounded-xl border border-lav-mid bg-white px-3 py-2 text-sm text-ink placeholder-ink-4 focus:border-brand focus:outline-none"
      />

      {/* Bulk action bar — sticks to the top while scrolling a long list */}
      {visibleSelected.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl bg-ink px-3 py-2.5 shadow-card">
          <p className="mr-auto text-xs font-bold text-white">{visibleSelected.length} selected</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => setResignFor({ keys: visibleSelected.map((r) => r.key), date: todayStr() })}
            className="rounded-xl bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
          >
            Mark resigned
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`Mark ${visibleSelected.length} selected as active again?`))
                runBulk(
                  () => bulkSetStatusAction(visibleSelected.map((r) => r.key), "active", null),
                  "marked active",
                );
            }}
            className="rounded-xl bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
          >
            Mark active
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const n = visibleSelected.length;
              if (
                confirm(
                  `Delete ${n} selected? Only people who haven't signed up are deleted — signed-up people are skipped (mark them resigned instead). This can't be undone.`,
                )
              )
                runBulk(() => deletePeopleAction(visibleSelected.map((r) => r.key)), "deleted");
            }}
            className="rounded-xl bg-red-500 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="px-1 text-[11px] font-bold text-white/70"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table (scrolls horizontally on narrow screens) */}
      <div className="overflow-x-auto rounded-card border border-lav-mid bg-white shadow-card">
        <table className="w-full min-w-[1040px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-lav-mid text-[10px] uppercase tracking-wide text-ink-3">
              <th className="w-9 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all shown"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected;
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 accent-brand"
                />
              </th>
              <Th>S.No</Th>
              <Th>Employee ID</Th>
              <Th className="min-w-[120px]">Name</Th>
              <Th>Email</Th>
              <Th>Team</Th>
              <Th>Department</Th>
              <Th>Grade</Th>
              <Th>Manager</Th>
              <Th className="min-w-[110px]">Roles</Th>
              <Th>Status</Th>
              <Th>Signed up</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-6 text-center text-[11px] text-ink-4">
                  {dir.rows.length === 0 ? "Nobody here yet — upload your people list." : "No one matches."}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr
                key={r.key}
                className={`border-b border-lav-light/70 align-top last:border-0 ${
                  selected.has(r.key) ? "bg-lav-light" : ""
                } ${r.status === "resigned" ? "opacity-60" : ""}`}
              >
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.name}`}
                    checked={selected.has(r.key)}
                    onChange={() => toggleOne(r.key)}
                    className="h-4 w-4 accent-brand"
                  />
                </td>
                <td className="px-3 py-2.5 text-ink-3">{i + 1}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-ink-2">
                  {r.employeeId ?? "—"}
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-semibold leading-snug text-ink">
                    {r.name}
                    {r.id === currentUserId && (
                      <span className="ml-1.5 text-[10px] font-bold text-ink-4">(you)</span>
                    )}
                  </p>
                  {r.leads.length > 0 && <p className="text-[10px] text-brand">Leads {r.leads.join(", ")}</p>}
                </td>
                <td className="px-3 py-2.5 text-ink-2">{r.email}</td>
                <td className="px-3 py-2.5 text-ink-2">{r.teamName ?? "—"}</td>
                <td className="px-3 py-2.5 text-ink-2">{r.departmentName ?? "—"}</td>
                <td className="px-3 py-2.5 text-ink-2">{r.grade ?? "—"}</td>
                <td className="px-3 py-2.5 text-ink-2">{r.managerName ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {r.roles.length === 0 && (
                      <span className="text-ink-4">{r.signedUp ? "None" : "After sign-up"}</span>
                    )}
                    {r.roles.map((role) => (
                      <span
                        key={role}
                        className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black"
                        style={{ background: `${ROLE_HEX[role]}1A`, color: ROLE_HEX[role] }}
                      >
                        {ROLE_LABEL[role]}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge row={r} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-2">
                  {r.signedUp ? (
                    "Yes"
                  ) : (
                    <span className="text-ink-4">
                      No
                      {r.emailStatus === "sent" && " · emailed"}
                      {r.emailStatus === "failed" && " · email failed"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="whitespace-nowrap rounded-xl bg-lav-mid px-3 py-1.5 text-[11px] font-bold text-brand active:scale-[0.98]"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="pb-2 text-center text-[11px] text-ink-4">
        Changes are saved to the live database immediately and recorded in the audit log.
      </p>

      {/* Mark resigned — asks for the leaving date and spells out the effect */}
      {resignFor && (
        <Modal title={`Mark ${resignFor.keys.length} as resigned`} onClose={() => setResignFor(null)}>
          <p className="mt-2 text-xs leading-snug text-ink-3">
            Their job ends on this date. They lose manager, CEO/HR and admin access and stop leading
            any team. Their account and personal data stay with them, and their past answers stay
            in team history.
          </p>
          <Field label="Left on">
            <input
              type="date"
              value={resignFor.date}
              onChange={(e) => setResignFor({ ...resignFor, date: e.target.value })}
              className={inputCls}
            />
          </Field>
          <p className="mt-3 text-[11px] text-ink-4">
            {dir.rows
              .filter((r) => resignFor.keys.includes(r.key))
              .slice(0, 8)
              .map((r) => r.name)
              .join(", ")}
            {resignFor.keys.length > 8 ? `, and ${resignFor.keys.length - 8} more` : ""}
          </p>
          <SheetButtons
            pending={pending}
            saveLabel="Mark resigned"
            onCancel={() => setResignFor(null)}
            onSave={() => {
              const { keys, date } = resignFor;
              setResignFor(null);
              runBulk(() => bulkSetStatusAction(keys, "resigned", date), "marked resigned");
            }}
          />
        </Modal>
      )}

      {/* Add / edit one person */}
      {edit && (
        <Modal title={edit.key ? `Edit ${edit.row?.name ?? ""}` : "Add person"} onClose={() => setEdit(null)}>
          {!edit.key && (
            <p className="mt-2 text-[11px] leading-snug text-ink-3">
              They&apos;re placed on their team as soon as they sign up with this email. Nobody is
              emailed — use Copy link to share the signup link.
            </p>
          )}
          <div className="grid grid-cols-2 gap-x-3">
            <Field label="Employee ID">
              <input
                value={edit.input.employeeId ?? ""}
                onChange={(e) => setInput({ employeeId: e.target.value })}
                className={inputCls}
                placeholder="e.g. E1042"
              />
            </Field>
            <Field label="Grade">
              <input
                value={edit.input.grade ?? ""}
                onChange={(e) => setInput({ grade: e.target.value })}
                className={inputCls}
                placeholder="e.g. L3"
              />
            </Field>
          </div>
          <Field label="Name">
            <input value={edit.input.name} onChange={(e) => setInput({ name: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={edit.input.email}
              disabled={!!edit.row?.signedUp}
              onChange={(e) => setInput({ email: e.target.value })}
              className={`${inputCls} disabled:opacity-60`}
            />
            {edit.row?.signedUp && (
              <p className="mt-1 text-[10px] text-ink-4">This is their sign-in email — only they can change it.</p>
            )}
          </Field>
          <Field label="Team">
            <select
              value={edit.input.teamId ?? ""}
              onChange={(e) => {
                const teamId = e.target.value || null;
                const team = dir.teams.find((t) => t.id === teamId);
                // Picking a team fills in its department if none is set yet.
                setInput({ teamId, departmentId: edit.input.departmentId ?? team?.departmentId ?? null });
              }}
              className={inputCls}
            >
              <option value="">No team</option>
              {dir.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <select
              value={edit.input.departmentId ?? ""}
              onChange={(e) => setInput({ departmentId: e.target.value || null })}
              className={inputCls}
            >
              <option value="">No department</option>
              {dir.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>

          {edit.row?.signedUp && (
            <Field label="Status">
              <div className="mt-1 flex gap-2">
                {(["active", "resigned"] as const).map((st) => (
                  <label
                    key={st}
                    className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                      edit.input.status === st ? "border-brand bg-lav-light" : "border-lav-mid"
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      checked={edit.input.status === st}
                      onChange={() =>
                        setInput({
                          status: st,
                          endedAt: st === "resigned" ? (edit.input.endedAt ?? todayStr()) : null,
                        })
                      }
                      className="h-4 w-4 accent-brand"
                    />
                    {st === "active" ? "Active" : "Resigned"}
                  </label>
                ))}
              </div>
            </Field>
          )}
          {edit.input.status === "resigned" && (
            <>
              <Field label="Left on">
                <input
                  type="date"
                  value={edit.input.endedAt ?? todayStr()}
                  onChange={(e) => setInput({ endedAt: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <p className="mt-1 text-[10px] leading-snug text-ink-4">
                Resigning removes manager, CEO/HR and admin access. Setting them active again
                doesn&apos;t restore those — re-grant them here.
              </p>
            </>
          )}

          {edit.row?.signedUp && edit.input.status === "active" && (
            <Field label="Roles">
              <div className="mt-1 grid grid-cols-2 gap-2">
                {ROLE_ORDER.map((role) => (
                  <label key={role} className="flex items-center gap-2 rounded-xl border border-lav-mid px-3 py-2">
                    <input
                      type="checkbox"
                      checked={edit.input.roles.includes(role)}
                      onChange={() =>
                        setInput({
                          roles: edit.input.roles.includes(role)
                            ? edit.input.roles.filter((x) => x !== role)
                            : [...edit.input.roles, role],
                        })
                      }
                      className="h-4 w-4 accent-brand"
                    />
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-black"
                      style={{ background: `${ROLE_HEX[role]}1A`, color: ROLE_HEX[role] }}
                    >
                      {ROLE_LABEL[role]}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[10px] leading-snug text-ink-4">
                To make someone a team&apos;s manager, set it in Org structure or the upload.
              </p>
            </Field>
          )}

          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>
          )}
          <SheetButtons
            pending={pending}
            saveLabel={edit.key ? "Save" : "Add person"}
            onCancel={() => setEdit(null)}
            onSave={saveEdit}
          />
          {edit.row && !edit.row.signedUp && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => copyLink(edit.key!)}
                className="flex-1 rounded-xl bg-lav-mid py-2 text-xs font-bold text-brand active:scale-[0.98]"
              >
                {copied === edit.key ? "Copied ✓" : "Copy signup link"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => emailInviteAction(edit.row!.id))}
                className="flex-1 rounded-xl bg-lav-mid py-2 text-xs font-bold text-brand active:scale-[0.98] disabled:opacity-50"
              >
                Email them the link
              </button>
            </div>
          )}
          {edit.row && !edit.row.signedUp && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm(`Delete ${edit.row!.name}? They haven't signed up, so nothing else is affected.`)) {
                  const key = edit.key!;
                  setEdit(null);
                  runBulk(() => deletePeopleAction([key]), "deleted");
                }
              }}
              className="mt-3 w-full text-center text-xs font-bold text-red-600 disabled:opacity-50"
            >
              Delete this person
            </button>
          )}
        </Modal>
      )}
    </ScreenShell>
  );
}

function statusLabel(r: DirectoryRow): string {
  if (r.status === "resigned") return "Resigned";
  if (r.status === "no_job") return "No job record";
  return "Active";
}

function StatusBadge({ row }: { row: DirectoryRow }) {
  const cls =
    row.status === "resigned"
      ? "bg-gray-100 text-ink-4"
      : row.status === "no_job"
        ? "bg-amber-50 text-warn"
        : "bg-green-50 text-good";
  return (
    <div>
      <span
        className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${cls}`}
      >
        {statusLabel(row)}
      </span>
      {row.endedAt && <p className="mt-0.5 whitespace-nowrap text-[10px] text-ink-4">left {row.endedAt}</p>}
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-xl border border-lav-mid bg-lav-light px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none";

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-3 py-2 font-bold ${className}`}>{children}</th>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <label className="block text-[11px] font-bold uppercase tracking-wide text-ink-3">{label}</label>
      {children}
    </div>
  );
}

function SheetButtons({
  pending,
  saveLabel,
  onCancel,
  onSave,
}: {
  pending: boolean;
  saveLabel: string;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
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
        {pending ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}
