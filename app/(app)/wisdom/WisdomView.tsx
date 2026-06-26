"use client";

import { useMemo, useState } from "react";
import { Card, GradientHeader, Mascot, ScreenShell } from "@/components/kit";
import { HEADER_MASCOT_SIZE } from "@/lib/mascot";
import type { MascotState } from "@/lib/mascot";
import type { WisdomData, WisdomItemType, WisdomLevelView, WisdomModuleView } from "@/lib/data";
import type { SessionUser } from "@/lib/types";

const TYPE_ICON: Record<WisdomItemType, string> = { video: "▶", article: "📄", quiz: "✎" };
const TYPE_LABEL: Record<WisdomItemType, string> = { video: "Video", article: "Article", quiz: "Quiz" };

// Header copy + nav differ by audience (employee growth vs manager leadership);
// everything below the header is shared. Defaults keep the employee screen as-is.
export function WisdomView({
  session,
  wisdom,
  eyebrow = "📚 Wisdom",
  title,
  mascotState = "happy",
  footnote = "Modules are ordered by your weakest pillar first.",
  active = "wisdom",
}: {
  session: SessionUser;
  wisdom: WisdomData;
  eyebrow?: string;
  title?: string;
  mascotState?: MascotState;
  footnote?: string;
  active?: "wisdom" | "insights" | "inbox" | "profile";
}) {
  const isPlay = session.themeMode === "play";
  const firstName = (session.name || "there").trim().split(/\s+/)[0];
  const heading = title ?? `Keep growing, ${firstName}`;

  // All item ids that start done; interaction adds to this set (sample state).
  const initialDone = useMemo(
    () =>
      new Set(
        wisdom.levels.flatMap((l) => l.modules.flatMap((m) => m.items.filter((i) => i.done).map((i) => i.id))),
      ),
    [wisdom],
  );
  const [done, setDone] = useState<Set<string>>(initialDone);

  const toggle = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Recompute the path from the live `done` set so unlocks/badges update instantly.
  const levels = useMemo<WisdomLevelView[]>(() => {
    let prevComplete = true;
    return wisdom.levels.map((l) => {
      const unlocked = prevComplete;
      const modules = l.modules.map((m) => {
        const items = m.items.map((i) => ({ ...i, done: done.has(i.id) }));
        const quiz = items.find((i) => i.type === "quiz");
        return { ...m, items, badgeEarned: !!quiz?.done };
      });
      prevComplete = modules.every((m) => m.badgeEarned);
      return { ...l, unlocked, modules };
    });
  }, [wisdom, done]);

  const allItems = levels.flatMap((l) => l.modules.flatMap((m) => m.items));
  const doneCount = allItems.filter((i) => i.done).length;
  const totalCount = allItems.length;
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  const currentLevel = [...levels].reverse().find((l) => l.unlocked) ?? levels[0];

  // Active module = first not-yet-badged module in the current unlocked level.
  const activeModule =
    currentLevel.modules.find((m) => !m.badgeEarned) ??
    levels.flatMap((l) => (l.unlocked ? l.modules : [])).find((m) => !m.badgeEarned) ??
    null;

  const earnedBadges = levels.flatMap((l) => l.modules.filter((m) => m.badgeEarned).map((m) => m.badge));

  return (
    <ScreenShell active={active}>
      {/* Header — Play: lavender card + mascot; Professional: gradient card, no mascot. */}
      {isPlay ? (
        <GradientHeader
          eyebrow={eyebrow}
          title={heading}
          avatar={<Mascot state={mascotState} size={HEADER_MASCOT_SIZE} float={false} sparkle={false} />}
          className="flex min-h-[180px] flex-col justify-center"
        >
          <ProgressMeter pct={pct} doneCount={doneCount} totalCount={totalCount} />
        </GradientHeader>
      ) : (
        <div
          className="rounded-card px-5 py-6"
          style={{ background: "linear-gradient(135deg, #EDE7FF 0%, #C9B4FF 100%)" }}
        >
          <p className="text-xs font-semibold text-brand/70">{eyebrow}</p>
          <h1 className="mt-1 font-display text-[30px] font-black leading-tight text-brand">
            {heading}
          </h1>
          <div className="mt-3">
            <ProgressMeter pct={pct} doneCount={doneCount} totalCount={totalCount} />
          </div>
        </div>
      )}

      {/* Current level + active module */}
      {activeModule && (
        <ActiveModuleCard level={currentLevel} module={activeModule} onToggle={toggle} />
      )}

      {/* Learning path */}
      <p className="px-1 pt-1 font-display text-sm font-black text-ink">Your learning path</p>
      <div className="space-y-3">
        {levels.map((l, i) => (
          <LevelCard key={l.level} level={l} onToggle={toggle} isLast={i === levels.length - 1} />
        ))}
      </div>

      {/* Badges */}
      <p className="px-1 pt-2 font-display text-sm font-black text-ink">
        🏅 Badges <span className="font-bold text-ink-3">· {earnedBadges.length}/{wisdom.badges.length}</span>
      </p>
      <div className="grid grid-cols-3 gap-2.5">
        {wisdom.badges.map((b, i) => {
          const earned = earnedBadges.includes(b.label);
          return (
            <div
              key={`${b.label}-${i}`}
              className={`rounded-card border p-3 text-center transition ${
                earned ? "border-lav-mid bg-white shadow-card" : "border-gray-200 bg-gray-50 opacity-50"
              }`}
            >
              <div className="text-2xl leading-none">{earned ? b.icon : "🔒"}</div>
              <p className={`mt-1.5 text-[10px] font-bold leading-tight ${earned ? "text-ink-2" : "text-ink-4"}`}>
                {b.label}
              </p>
            </div>
          );
        })}
      </div>

      <p className="pb-2 text-center text-[11px] text-ink-4">{footnote}</p>
    </ScreenShell>
  );
}

function ProgressMeter({ pct, doneCount, totalCount }: { pct: number; doneCount: number; totalCount: number }) {
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-white/50">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs font-bold text-brand">{doneCount}/{totalCount} lessons complete · {pct}%</p>
    </div>
  );
}

// ── Active module — the next thing to work on ────────────────────────────────
function ActiveModuleCard({
  level,
  module,
  onToggle,
}: {
  level: WisdomLevelView;
  module: WisdomModuleView;
  onToggle: (id: string) => void;
}) {
  const doneN = module.items.filter((i) => i.done).length;
  return (
    <Card className="border border-lav-mid">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-lav-soft px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
          {level.icon} {level.name} · Up next
        </span>
        <span className="text-[11px] font-bold text-ink-3">{doneN}/{module.items.length}</span>
      </div>
      <p className="mt-2.5 font-display text-lg font-black leading-tight text-ink">{module.title}</p>
      <p className="text-xs text-ink-3">{module.pillarLabel} · earn the {module.badge} badge</p>

      <div className="mt-3 space-y-1">
        {module.items.map((it) => (
          <ItemRow key={it.id} item={it} onToggle={onToggle} />
        ))}
      </div>
    </Card>
  );
}

// ── Level accordion ──────────────────────────────────────────────────────────
function LevelCard({
  level,
  onToggle,
  isLast,
}: {
  level: WisdomLevelView;
  onToggle: (id: string) => void;
  isLast: boolean;
}) {
  const badged = level.modules.filter((m) => m.badgeEarned).length;
  const total = level.modules.length;
  const complete = badged === total;
  const [open, setOpen] = useState(level.unlocked && !complete);

  return (
    <div
      className={`overflow-hidden rounded-card border bg-white transition ${
        complete ? "border-lav-mid" : level.unlocked ? "border-lav-light shadow-card" : "border-gray-200 opacity-60"
      }`}
    >
      <button
        type="button"
        onClick={() => level.unlocked && setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <div
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-xl ${
            level.unlocked ? "bg-lav-soft" : "bg-gray-100"
          }`}
        >
          {level.unlocked ? level.icon : "🔒"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-black text-ink">{level.name}</span>
            {complete && (
              <span className="rounded-full bg-lav-soft px-2 py-0.5 text-[10px] font-bold text-brand">Complete ✓</span>
            )}
            {!level.unlocked && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-ink-4">Locked</span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-ink-3">
            {level.unlocked ? level.subtitle : "Earn every badge in the level above to unlock"}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="text-[11px] font-bold text-ink-3">{badged}/{total}</span>
          {level.unlocked && (
            <span className={`text-brand-light transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
          )}
        </div>
      </button>

      {level.unlocked && (
        <div className="h-1 bg-lav-soft">
          <div className="h-full bg-brand transition-all" style={{ width: `${(badged / total) * 100}%` }} />
        </div>
      )}

      {level.unlocked && open && (
        <div className="space-y-3 border-t border-lav-soft px-4 py-3.5">
          {level.modules.map((m) => (
            <ModuleBlock key={m.id} module={m} onToggle={onToggle} />
          ))}
          {complete && (
            <div className="rounded-card bg-lav-soft px-4 py-3 text-center">
              <p className="text-[13px] font-bold text-brand">
                {isLast ? "🏆 You've mastered every level!" : "🎉 Level complete — next level unlocked."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModuleBlock({ module, onToggle }: { module: WisdomModuleView; onToggle: (id: string) => void }) {
  return (
    <div className="rounded-card bg-lav-soft/60 p-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="font-display text-sm font-black text-ink">{module.title}</p>
        {module.badgeEarned ? (
          <span className="text-[11px] font-bold text-brand">🏅 {module.badge}</span>
        ) : (
          <span className="text-[10px] font-semibold text-ink-4">{module.pillarLabel}</span>
        )}
      </div>
      <div className="space-y-1">
        {module.items.map((it) => (
          <ItemRow key={it.id} item={it} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
}: {
  item: { id: string; title: string; type: WisdomItemType; duration: string; desc: string; done: boolean };
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-[13px] ${
          item.done ? "bg-brand text-white" : "bg-white text-brand shadow-card"
        }`}
      >
        {item.done ? "✓" : TYPE_ICON[item.type]}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-semibold leading-snug ${item.done ? "text-ink-4 line-through" : "text-ink"}`}>
          {item.title}
        </p>
        <p className="text-[10px] text-ink-4">{TYPE_LABEL[item.type]} · {item.duration}</p>
      </div>
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold transition active:scale-95 ${
          item.done ? "bg-lav-mid text-brand" : item.type === "quiz" ? "bg-brand text-white" : "bg-lav-soft text-brand"
        }`}
      >
        {item.done ? "Done" : item.type === "quiz" ? "Take quiz" : "Start"}
      </button>
    </div>
  );
}
