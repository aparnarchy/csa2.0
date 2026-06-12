import type { ReactNode } from "react";

/**
 * Purple gradient header card used at the top of dashboards and detail screens.
 * `accent` lets pillar-detail screens tint the gradient to the pillar colour.
 */
export function GradientHeader({
  eyebrow,
  title,
  subtitle,
  accent = "#7C6FFF",
  accentTo = "#9B8FFF",
  avatar,
  back,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  accent?: string;
  accentTo?: string;
  avatar?: ReactNode;
  back?: { label: string; onClick: () => void };
  children?: ReactNode;
}) {
  return (
    <div
      className="relative rounded-card px-5 pb-6 pt-5"
      style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accentTo} 100%)` }}
    >
      {avatar && <div className="absolute -top-3.5 right-3.5 z-10">{avatar}</div>}

      {back && (
        <button
          type="button"
          onClick={back.onClick}
          className="mb-3 inline-flex items-center gap-1.5 rounded-[10px] bg-white/15 px-3 py-1.5 text-xs font-bold text-white active:scale-95"
        >
          ← {back.label}
        </button>
      )}

      {eyebrow && <p className="mb-1.5 text-xs text-white/70">{eyebrow}</p>}
      <h1 className="font-display text-[22px] font-black leading-tight text-white">{title}</h1>
      {subtitle && <p className="mt-1.5 text-[11px] text-white/65">{subtitle}</p>}
      {children}
    </div>
  );
}
