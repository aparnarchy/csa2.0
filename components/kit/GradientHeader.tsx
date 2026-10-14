import type { ReactNode } from "react";
import { BackButton } from "./BackButton";

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
  back,
  switcher,
  children,
  below,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  avatar?: ReactNode;
  back?: { label: string; onClick: () => void };
  /** Optional view switcher chip (ViewSwitcher) above the eyebrow — in the
      text column, so it can never collide with the mascot. */
  switcher?: ReactNode;
  children?: ReactNode;
  /** Full-width content rendered BELOW the title+mascot row (e.g. a stats row
      that would be squished if placed in the narrow left column). */
  below?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-card px-5 pb-5 pt-4 ${className}`}
      style={{ background: "linear-gradient(160deg, #EDE7FF 0%, #E1D7FF 100%)" }}
    >
      {/* Text on the left, mascot on the right — a flex row so the mascot can
          never overlap or hide the title (incl. long pillar names). */}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {back && <BackButton label={back.label} onClick={back.onClick} />}
          {switcher}

          {eyebrow && <p className="mb-1.5 text-xs text-ink-3">{eyebrow}</p>}
          <h1 className="font-display text-[28px] font-black leading-tight text-brand">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[11px] text-ink-3">{subtitle}</p>}
          {children}
        </div>

        {avatar && <div className="flex-shrink-0">{avatar}</div>}
      </div>

      {below && <div className="mt-4">{below}</div>}
    </div>
  );
}
