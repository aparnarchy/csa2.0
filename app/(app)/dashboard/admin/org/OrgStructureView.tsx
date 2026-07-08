"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Card, Modal, ScreenShell } from "@/components/kit";
import type { SessionUser } from "@/lib/types";
import type { OrgStructure, TeamInput } from "@/lib/admin";
import {
  createDepartmentAction,
  createTeamAction,
  deleteDepartmentAction,
  deleteTeamAction,
  updateDepartmentAction,
  updateTeamAction,
} from "../actions";

type DeptEdit = { id: string | null; name: string };
type TeamEdit = { id: string | null; input: TeamInput };

export function OrgStructureView({
  session,
  initial,
}: {
  session: SessionUser;
  initial: OrgStructure;
}) {
  const router = useRouter();
  const isPlay = session.themeMode === "play";
  const [org, setOrg] = useState<OrgStructure>(initial);
  const [deptEdit, setDeptEdit] = useState<DeptEdit | null>(null);
  const [teamEdit, setTeamEdit] = useState<TeamEdit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const deptName = useMemo(() => {
    const m = new Map(org.departments.map((d) => [d.id, d.name]));
    return (id: string | null) => (id && m.get(id)) || "Unassigned";
  }, [org.departments]);

  const mgrName = useMemo(() => {
    const m = new Map(org.managers.map((g) => [g.id, g.name]));
    return (id: string | null) => (id && m.get(id)) || "No manager";
  }, [org.managers]);

  const teamCount = useMemo(() => {
    const c = new Map<string, number>();
    for (const t of org.teams) if (t.departmentId) c.set(t.departmentId, (c.get(t.departmentId) ?? 0) + 1);
    return c;
  }, [org.teams]);

  function run(fn: () => Promise<OrgStructure>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        setOrg(await fn());
        onDone?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <ScreenShell>
      {isPlay ? (
        <div className="rounded-card bg-lav-bg px-5 py-5">
          <BackBtn onClick={() => router.push("/dashboard/admin")} />
          <p className="text-xs font-semibold text-brand/70">🏢 Org structure</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-ink">
            Departments &amp; teams
          </h1>
        </div>
      ) : (
        <div
          className="rounded-card px-5 py-5"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <BackBtn onClick={() => router.push("/dashboard/admin")} />
          <p className="text-xs font-semibold text-brand/70">🏢 Org structure</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-brand">
            Departments &amp; teams
          </h1>
        </div>
      )}

      {error && !deptEdit && !teamEdit && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>
      )}

      {/* Departments */}
      <SectionHeader
        title="Departments"
        count={org.departments.length}
        onAdd={() => {
          setError(null);
          setDeptEdit({ id: null, name: "" });
        }}
      />
      <div className="space-y-2">
        {org.departments.length === 0 && <Empty>No departments yet.</Empty>}
        {org.departments.map((d) => (
          <Card key={d.id}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-display text-base font-black text-ink">{d.name}</p>
                <p className="text-[11px] text-ink-3">
                  {teamCount.get(d.id) ?? 0} {(teamCount.get(d.id) ?? 0) === 1 ? "team" : "teams"}
                </p>
              </div>
              <RowButtons
                pending={pending}
                onEdit={() => {
                  setError(null);
                  setDeptEdit({ id: d.id, name: d.name });
                }}
                onDelete={() => {
                  if (confirm(`Delete department "${d.name}"? Its teams will become unassigned.`))
                    run(() => deleteDepartmentAction(d.id));
                }}
              />
            </div>
          </Card>
        ))}
      </div>

      {/* Teams */}
      <SectionHeader
        title="Teams"
        count={org.teams.length}
        onAdd={() => {
          setError(null);
          setTeamEdit({ id: null, input: { name: "", departmentId: null, managerId: null } });
        }}
      />
      <div className="space-y-2">
        {org.teams.length === 0 && <Empty>No teams yet.</Empty>}
        {org.teams.map((t) => (
          <Card key={t.id}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-display text-base font-black text-ink">{t.name}</p>
                <p className="text-[11px] text-ink-3">
                  {deptName(t.departmentId)} · {mgrName(t.managerId)}
                </p>
              </div>
              <RowButtons
                pending={pending}
                onEdit={() => {
                  setError(null);
                  setTeamEdit({
                    id: t.id,
                    input: { name: t.name, departmentId: t.departmentId, managerId: t.managerId },
                  });
                }}
                onDelete={() => {
                  if (confirm(`Delete team "${t.name}"?`)) run(() => deleteTeamAction(t.id));
                }}
              />
            </div>
          </Card>
        ))}
      </div>

      <p className="pb-2 text-center text-[11px] text-ink-4">
        Changes are saved to the live database immediately.
      </p>

      {/* Department editor */}
      {deptEdit && (
        <Sheet
          title={deptEdit.id ? "Edit department" : "New department"}
          pending={pending}
          error={error}
          onCancel={() => {
            setDeptEdit(null);
            setError(null);
          }}
          onSave={() =>
            run(
              () =>
                deptEdit.id
                  ? updateDepartmentAction(deptEdit.id, deptEdit.name)
                  : createDepartmentAction(deptEdit.name),
              () => setDeptEdit(null),
            )
          }
        >
          <Field label="Department name">
            <input
              value={deptEdit.name}
              onChange={(e) => setDeptEdit({ ...deptEdit, name: e.target.value })}
              className={inputCls}
              placeholder="e.g. Marketing"
            />
          </Field>
        </Sheet>
      )}

      {/* Team editor */}
      {teamEdit && (
        <Sheet
          title={teamEdit.id ? "Edit team" : "New team"}
          pending={pending}
          error={error}
          onCancel={() => {
            setTeamEdit(null);
            setError(null);
          }}
          onSave={() =>
            run(
              () =>
                teamEdit.id
                  ? updateTeamAction(teamEdit.id, teamEdit.input)
                  : createTeamAction(teamEdit.input),
              () => setTeamEdit(null),
            )
          }
        >
          <Field label="Team name">
            <input
              value={teamEdit.input.name}
              onChange={(e) =>
                setTeamEdit({ ...teamEdit, input: { ...teamEdit.input, name: e.target.value } })
              }
              className={inputCls}
              placeholder="e.g. Platform Team"
            />
          </Field>
          <Field label="Department">
            <select
              value={teamEdit.input.departmentId ?? ""}
              onChange={(e) =>
                setTeamEdit({
                  ...teamEdit,
                  input: { ...teamEdit.input, departmentId: e.target.value || null },
                })
              }
              className={inputCls}
            >
              <option value="">Unassigned</option>
              {org.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Manager">
            <select
              value={teamEdit.input.managerId ?? ""}
              onChange={(e) =>
                setTeamEdit({
                  ...teamEdit,
                  input: { ...teamEdit.input, managerId: e.target.value || null },
                })
              }
              className={inputCls}
            >
              <option value="">No manager</option>
              {org.managers.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.email})
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

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-2 text-xs font-bold text-brand">
      ← Admin
    </button>
  );
}

function SectionHeader({
  title,
  count,
  onAdd,
}: {
  title: string;
  count: number;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-1 pt-2">
      <p className="font-display text-sm font-black text-ink">
        {title} · {count}
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="rounded-full bg-brand px-3.5 py-1.5 font-display text-xs font-black text-white active:scale-[0.97]"
      >
        + Add
      </button>
    </div>
  );
}

function RowButtons({
  pending,
  onEdit,
  onDelete,
}: {
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-shrink-0 gap-2">
      <button
        type="button"
        onClick={onEdit}
        className="rounded-xl bg-lav-mid px-3 py-1.5 text-xs font-bold text-brand active:scale-[0.98]"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 active:scale-[0.98] disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-1 text-[11px] text-ink-4">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <label className="block text-[11px] font-bold uppercase tracking-wide text-ink-3">{label}</label>
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
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
    </Modal>
  );
}
