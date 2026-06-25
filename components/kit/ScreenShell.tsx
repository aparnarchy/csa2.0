import Link from "next/link";
import type { ReactNode } from "react";

type NavKey = "inbox" | "insights" | "wisdom" | "profile";

const NAV: { key: NavKey; label: string; href: string; icon: string }[] = [
  { key: "profile",  label: "Profile",  href: "/profile",            icon: "👤" },
  { key: "insights", label: "Insights", href: "/dashboard/employee", icon: "📊" },
  { key: "wisdom",   label: "Wisdom",   href: "/wisdom",             icon: "📚" },
  { key: "inbox",    label: "Inbox",    href: "/inbox",              icon: "📥" },
];

/**
 * Mobile-first page frame: optional sticky header, scrollable content on the
 * lavender background, fixed bottom nav. Screens with their own gradient header
 * omit `title`.
 */
export function ScreenShell({
  title,
  active,
  headerRight,
  children,
}: {
  title?: string;
  active?: NavKey;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-lav-bg">
      {title && (
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/40 bg-lav-bg/90 px-5 py-4 backdrop-blur">
          <h1 className="font-display text-xl font-black text-ink">{title}</h1>
          {headerRight}
        </header>
      )}

      <main className="screen-enter flex-1 space-y-3.5 px-4 py-4 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md items-center justify-around border-t border-white/50 bg-white/95 px-2 py-2 backdrop-blur">
        {NAV.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold ${
                isActive ? "text-brand" : "text-ink-4"
              }`}
            >
              <span className="text-lg" aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
