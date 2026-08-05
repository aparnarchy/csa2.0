"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, Modal, ScreenShell } from "@/components/kit";
import { PILLARS, PILLAR_ORDER } from "@/lib/pillars";
import type {
  ContentType,
  PillarId,
  SessionUser,
  WisdomAudience,
  WisdomLevel,
} from "@/lib/types";
import type {
  WisdomContentInput,
  WisdomModuleInput,
  WisdomModuleWithContent,
} from "@/lib/admin";
import {
  createContentAction,
  createModuleAction,
  deleteContentAction,
  deleteModuleAction,
  updateContentAction,
  updateModuleAction,
} from "../actions";

const LEVELS: WisdomLevel[] = ["beginner", "advanced", "expert"];
const AUDIENCES: WisdomAudience[] = ["employee", "manager", "both"];
const CONTENT_TYPES: ContentType[] = ["lesson", "article", "video", "quiz"];
const LEVEL_LABEL: Record<WisdomLevel, string> = {
  beginner: "Beginner",
  advanced: "Advanced",
  expert: "Expert",
};
const TYPE_ICON: Record<ContentType, string> = { lesson: "📖", article: "📄", video: "🎬", quiz: "❓" };

const BLANK_MODULE: WisdomModuleInput = {
  title: "",
  pillarId: "meaningful_work",
  audience: "employee",
  level: "beginner",
  badgeAwarded: "",
  isActive: true,
};

type ModuleEdit = { id: string | null; input: WisdomModuleInput };
type ContentEdit = { moduleId: string; id: string | null; input: WisdomContentInput };

export function WisdomCmsView({
  session,
  initial,
}: {
  session: SessionUser;
  initial: WisdomModuleWithContent[];
}) {
  const router = useRouter();
  const isPlay = session.themeMode === "play";
  const [modules, setModules] = useState(initial);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [modEdit, setModEdit] = useState<ModuleEdit | null>(null);
  const [conEdit, setConEdit] = useState<ContentEdit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<WisdomModuleWithContent[]>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        setModules(await fn());
        onDone?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    });
  }

  const byLevel = LEVELS.map((lvl) => ({ lvl, items: modules.filter((m) => m.level === lvl) }));

  return (
    <ScreenShell wide>
      {isPlay ? (
        <div className="rounded-card bg-lav-bg px-5 py-5">
          <BackBtn onClick={() => router.push("/dashboard/admin")} />
          <p className="text-xs font-semibold text-brand/70">📚 Wisdom content</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-ink">
            Modules &amp; lessons
          </h1>
        </div>
      ) : (
        <div
          className="rounded-card px-5 py-5"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <BackBtn onClick={() => router.push("/dashboard/admin")} />
          <p className="text-xs font-semibold text-brand/70">📚 Wisdom content</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-tight text-brand">
            Modules &amp; lessons
          </h1>
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-ink-3">
          {modules.length} {modules.length === 1 ? "module" : "modules"}
        </p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setModEdit({ id: null, input: { ...BLANK_MODULE } });
          }}
          className="rounded-full bg-brand px-3.5 py-1.5 font-display text-xs font-black text-white active:scale-[0.97]"
        >
          + Add module
        </button>
      </div>

      {error && !modEdit && !conEdit && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>
      )}

      {modules.length === 0 && (
        <Card>
          <p className="text-xs text-ink-3">
            No modules yet. Add one to start building the learning path.
          </p>
        </Card>
      )}

      {byLevel.map(({ lvl, items }) =>
        items.length === 0 ? null : (
          <div key={lvl} className="space-y-2">
            <p className="px-1 pt-1 font-display text-sm font-black text-ink">
              {LEVEL_LABEL[lvl]} · {items.length}
            </p>
            {items.map((m) => {
              const isOpen = !!open[m.id];
              return (
                <Card key={m.id}>
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                          style={{ background: PILLARS[m.pillarId].hex }}
                        />
                        <p className="truncate font-display text-base font-black text-ink">{m.title}</p>
                        {!m.isActive && (
                          <span className="flex-shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-ink-3">
                            Draft
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-ink-3">
                        {PILLARS[m.pillarId].label} · {m.audience} · {m.content.length}{" "}
                        {m.content.length === 1 ? "item" : "items"}
                        {m.badgeAwarded ? ` · 🏅 ${m.badgeAwarded}` : ""}
                      </p>
                    </button>
                    <span className="flex-shrink-0 text-[10px] text-brand">{isOpen ? "▲" : "▼"}</span>
                  </div>

                  {isOpen && (
                    <div className="mt-3 border-t border-lav-soft pt-3">
                      <div className="space-y-1.5">
                        {m.content.length === 0 && (
                          <p className="text-[11px] text-ink-4">No content items yet.</p>
                        )}
                        {m.content.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-2 rounded-xl bg-lav-light px-3 py-2"
                          >
                            <span className="flex-shrink-0">{TYPE_ICON[c.type]}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-semibold text-ink">{c.title}</p>
                              <p className="text-[10px] text-ink-3">
                                {c.type} · #{c.sortOrder}
                                {!c.isActive ? " · draft" : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setConEdit({
                                  moduleId: m.id,
                                  id: c.id,
                                  input: {
                                    title: c.title,
                                    type: c.type,
                                    body: c.body,
                                    sortOrder: c.sortOrder,
                                    isActive: c.isActive,
                                  },
                                })
                              }
                              className="flex-shrink-0 text-[11px] font-bold text-brand"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                confirm(`Delete "${c.title}"?`) &&
                                run(() => deleteContentAction(c.id))
                              }
                              disabled={pending}
                              className="flex-shrink-0 text-[11px] font-bold text-red-600 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setConEdit({
                              moduleId: m.id,
                              id: null,
                              input: {
                                title: "",
                                type: "lesson",
                                body: "",
                                sortOrder: m.content.length + 1,
                                isActive: true,
                              },
                            })
                          }
                          className="flex-1 rounded-xl bg-lav-mid py-2 text-xs font-bold text-brand active:scale-[0.98]"
                        >
                          + Add item
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setModEdit({
                              id: m.id,
                              input: {
                                title: m.title,
                                pillarId: m.pillarId,
                                audience: m.audience,
                                level: m.level,
                                badgeAwarded: m.badgeAwarded ?? "",
                                isActive: m.isActive,
                              },
                            })
                          }
                          className="rounded-xl bg-lav-mid px-4 py-2 text-xs font-bold text-brand active:scale-[0.98]"
                        >
                          Edit module
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            confirm(`Delete module "${m.title}" and all its items?`) &&
                            run(() => deleteModuleAction(m.id))
                          }
                          disabled={pending}
                          className="rounded-xl bg-red-50 px-4 py-2 text-xs font-bold text-red-600 active:scale-[0.98] disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ),
      )}

      <p className="pb-2 text-center text-[11px] text-ink-4">
        Changes are saved to the live database immediately.
      </p>

      {/* Module editor */}
      {modEdit && (
        <Sheet
          title={modEdit.id ? "Edit module" : "New module"}
          pending={pending}
          error={error}
          onCancel={() => {
            setModEdit(null);
            setError(null);
          }}
          onSave={() =>
            run(
              () =>
                modEdit.id
                  ? updateModuleAction(modEdit.id, modEdit.input)
                  : createModuleAction(modEdit.input),
              () => setModEdit(null),
            )
          }
        >
          <Field label="Module title">
            <input
              value={modEdit.input.title}
              onChange={(e) => setModEdit({ ...modEdit, input: { ...modEdit.input, title: e.target.value } })}
              className={inputCls}
              placeholder="e.g. Finding meaning in your work"
            />
          </Field>
          <Field label="Pillar">
            <select
              value={modEdit.input.pillarId}
              onChange={(e) =>
                setModEdit({ ...modEdit, input: { ...modEdit.input, pillarId: e.target.value as PillarId } })
              }
              className={inputCls}
            >
              {PILLAR_ORDER.map((pid) => (
                <option key={pid} value={pid}>
                  {PILLARS[pid].label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex gap-2">
            <Field label="Audience" className="flex-1">
              <select
                value={modEdit.input.audience}
                onChange={(e) =>
                  setModEdit({
                    ...modEdit,
                    input: { ...modEdit.input, audience: e.target.value as WisdomAudience },
                  })
                }
                className={inputCls}
              >
                {AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Level" className="flex-1">
              <select
                value={modEdit.input.level}
                onChange={(e) =>
                  setModEdit({
                    ...modEdit,
                    input: { ...modEdit.input, level: e.target.value as WisdomLevel },
                  })
                }
                className={inputCls}
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABEL[l]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Badge awarded (optional)">
            <input
              value={modEdit.input.badgeAwarded ?? ""}
              onChange={(e) =>
                setModEdit({ ...modEdit, input: { ...modEdit.input, badgeAwarded: e.target.value } })
              }
              className={inputCls}
              placeholder="e.g. Purpose Pro"
            />
          </Field>
          <ActiveToggle
            label="Published (visible to learners)"
            checked={modEdit.input.isActive}
            onChange={(v) => setModEdit({ ...modEdit, input: { ...modEdit.input, isActive: v } })}
          />
        </Sheet>
      )}

      {/* Content editor */}
      {conEdit && (
        <Sheet
          title={conEdit.id ? "Edit content item" : "New content item"}
          pending={pending}
          error={error}
          onCancel={() => {
            setConEdit(null);
            setError(null);
          }}
          onSave={() =>
            run(
              () =>
                conEdit.id
                  ? updateContentAction(conEdit.id, conEdit.input)
                  : createContentAction(conEdit.moduleId, conEdit.input),
              () => setConEdit(null),
            )
          }
        >
          <Field label="Title">
            <input
              value={conEdit.input.title}
              onChange={(e) => setConEdit({ ...conEdit, input: { ...conEdit.input, title: e.target.value } })}
              className={inputCls}
              placeholder="e.g. Why purpose matters"
            />
          </Field>
          <div className="flex gap-2">
            <Field label="Type" className="flex-1">
              <select
                value={conEdit.input.type}
                onChange={(e) =>
                  setConEdit({ ...conEdit, input: { ...conEdit.input, type: e.target.value as ContentType } })
                }
                className={inputCls}
              >
                {CONTENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Order" className="w-24">
              <input
                type="number"
                min={1}
                value={conEdit.input.sortOrder}
                onChange={(e) =>
                  setConEdit({
                    ...conEdit,
                    input: { ...conEdit.input, sortOrder: Math.max(1, Math.round(Number(e.target.value))) },
                  })
                }
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Body / notes (optional)">
            <textarea
              value={conEdit.input.body ?? ""}
              onChange={(e) => setConEdit({ ...conEdit, input: { ...conEdit.input, body: e.target.value } })}
              rows={3}
              className={inputCls}
              placeholder="Lesson text, article summary, or video link…"
            />
          </Field>
          <ActiveToggle
            label="Published"
            checked={conEdit.input.isActive}
            onChange={(v) => setConEdit({ ...conEdit, input: { ...conEdit.input, isActive: v } })}
          />
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

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mt-3 ${className}`}>
      <label className="block text-[11px] font-bold uppercase tracking-wide text-ink-3">{label}</label>
      {children}
    </div>
  );
}

function ActiveToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mt-4 flex items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-brand"
      />
      {label}
    </label>
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
