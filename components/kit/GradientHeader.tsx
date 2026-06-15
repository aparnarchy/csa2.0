import type { ReactNode } from "react";

/**
 * Soft lavender header card used at the top of dashboards and detail screens.
 * It's a slightly-darker-than-#F2EEFF lavender so the (more saturated) mascot
 * pops against it. Text is purple/ink (not white) to read on the light box.
 */
export function GradientHeader({
  eyebrow,
  title,
  subtitle,
  avatar,
  avatarClassName = "absolute -top-3 right-2 z-10",
  back,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  avatar?: ReactNode;
  avatarClassName?: string;
  back?: { label: string; onClick: () => void };
  children?: ReactNode;
}) {
  return (
    <div
      className="relative rounded-card px-5 pb-6 pt-5"
      style={{ background: "linear-gradient(160deg, #EDE7FF 0%, #E1D7FF 100%)" }}
    >
      {avatar && <div className={avatarClassName}>{avatar}</div>}

      {back && (
        <button
          type="button"
          onClick={back.onClick}
          className="mb-3 inline-flex items-center gap-1.5 rounded-[10px] bg-white/70 px-3 py-1.5 text-xs font-bold text-brand shadow-sm active:scale-95"
        >
          ← {back.label}
        </button>
      )}

      {eyebrow && <p className="mb-1.5 text-xs text-ink-3">{eyebrow}</p>}
      <h1 className="font-display text-[28px] font-black leading-tight text-brand">{title}</h1>
      {subtitle && <p className="mt-1.5 text-[11px] text-ink-3">{subtitle}</p>}
      {children}
    </div>
  );
}
