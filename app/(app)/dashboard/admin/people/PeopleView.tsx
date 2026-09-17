"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { BackButton, Modal, ScreenShell } from "@/components/kit";
import type { PersonRow } from "@/lib/admin";
import type { Role, SessionUser } from "@/lib/types";
import { setUserRolesAction } from "../actions";

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

export function PeopleView({
  session,
  initial,
  currentUserId,
}: {
  session: SessionUser;
  initial: PersonRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const isPlay = session.themeMode === "play";
  const [people, setPeople] = useState<PersonRow[]>(initial);
  const [editing, setEditing] = useState<{ person: PersonRow; roles: Set<Role> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter(
      (p) =>
        (roleFilter === "all" || p.roles.includes(roleFilter)) &&
        (q === "" || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)),
    );
  }, [people, search, roleFilter]);

  function openEdit(person: PersonRow) {
    setError(null);
    setEditing({ person, roles: new Set(person.roles) });
  }

  function toggleRole(role: Role) {
    if (!editing) return;
    const next = new Set(editing.roles);
    if (next.has(role)) next.delete(role);
    else next.add(role);
    setEditing({ ...editing, roles: next });
  }

  function save() {
    if (!editing) return;
    setError(null);
    const { person, roles } = editing;
    startTransition(async () => {
      try {
        const next = await setUserRolesAction(person.id, [...roles]);
        setPeople(next);
        setEditing(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save. Please try again.");
      }
    });
  }

  return (
    <ScreenShell wide noNav>
      {isPlay ? (
        <div className="rounded-card bg-lav-bg px-5 py-5">
          <BackButton label="Admin" onClick={() => router.push("/dashboard/admin")} />
          <p className="text-xs font-semibold text-brand/70">👥 People &amp; roles</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-ink">
            Who can do what
          </h1>
        </div>
      ) : (
        <div
          className="rounded-card px-5 py-5"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <BackButton label="Admin" onClick={() => router.push("/dashboard/admin")} />
          <p className="text-xs font-semibold text-brand/70">👥 People &amp; roles</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-brand">
            Who can do what
          </h1>
        </div>
      )}

      <div className="space-y-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="w-full rounded-xl border border-lav-mid bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:outline-none"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | "all")}
          className="w-full rounded-xl border border-lav-mid bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
        >
          <option value="all">All roles</option>
          {ROLE_ORDER.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <p className="px-1 text-[11px] text-ink-4">
          {filtered.length} of {people.length} people
        </p>
      </div>

      {error && !editing && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>
      )}

      <div className="overflow-x-auto rounded-card border border-lav-mid bg-white shadow-card">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-lav-mid text-[10px] uppercase tracking-wide text-ink-3">
              <Th className="min-w-[160px]">Name</Th>
              <Th className="min-w-[200px]">Email</Th>
              <Th className="min-w-[150px]">Team</Th>
              <Th className="min-w-[220px]">Roles</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[11px] text-ink-4">
                  No people match.
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-lav-light/70 align-top last:border-0">
                <td className="px-3 py-2.5">
                  <p className="font-semibold leading-snug text-ink">
                    {p.name}
                    {p.id === currentUserId && (
                      <span className="ml-1.5 text-[10px] font-bold text-ink-4">(you)</span>
                    )}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-ink-2">{p.email}</td>
                <td className="px-3 py-2.5 text-ink-2">
                  {p.teamName ?? <span className="text-ink-4">—</span>}
                  {p.departmentName && (
                    <span className="block text-[10px] text-ink-4">{p.departmentName}</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {p.roles.length === 0 && <span className="text-ink-4">No roles</span>}
                    {p.roles.map((r) => (
                      <span
                        key={r}
                        className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black"
                        style={{ background: `${ROLE_HEX[r]}1A`, color: ROLE_HEX[r] }}
                      >
                        {ROLE_LABEL[r]}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="whitespace-nowrap rounded-xl bg-lav-mid px-3 py-1.5 text-[11px] font-bold text-brand active:scale-[0.98]"
                  >
                    Edit roles
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="pb-2 text-center text-[11px] text-ink-4">
        Changes are saved to the live database immediately and take effect next time that person
        loads a page.
      </p>

      {editing && (
        <Modal title={`Roles for ${editing.person.name}`} onClose={() => setEditing(null)}>
          <p className="mt-2 text-xs text-ink-3">
            A person can hold more than one role at once — e.g. a manager who is also an admin.
          </p>
          <div className="mt-3 space-y-2">
            {ROLE_ORDER.map((r) => (
              <label
                key={r}
                className="flex items-center gap-3 rounded-xl border border-lav-mid px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  checked={editing.roles.has(r)}
                  onChange={() => toggleRole(r)}
                  className="h-4 w-4 accent-brand"
                />
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-black"
                  style={{ background: `${ROLE_HEX[r]}1A`, color: ROLE_HEX[r] }}
                >
                  {ROLE_LABEL[r]}
                </span>
              </label>
            ))}
          </div>

          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
              {error}
            </p>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              disabled={pending}
              className="flex-1 rounded-2xl bg-lav-mid py-3 font-display text-sm font-black text-brand active:scale-[0.98] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="flex-1 rounded-2xl bg-brand py-3 font-display text-sm font-black text-white active:scale-[0.98] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </ScreenShell>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-bold ${className}`}>{children}</th>;
}
