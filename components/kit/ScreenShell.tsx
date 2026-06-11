import Link from "next/link";
import type { ReactNode } from "react";

type NavKey = "home" | "insights" | "wisdom" | "profile";

const NAV: { key: NavKey; label: string; href: string; icon: string }[] = [
  { key: "home",     label: "Home",     href: "/dashboard",        icon: "🏠" },
  { key: "insights", label: "Insights", href: "/dashboard/employee", icon: "📊" },
  { key: "wisdom",   label: "Wisdom",   href: "/wisdom",           icon: "📚" },
  { key: "profile",  label: "Profile",  href: "/profile",          icon: "👤" },
];

/**
 * Mobile-first page frame: sticky header, scrollable content, fixed bottom nav.
 * Every signed-in screen renders inside this so layout stays consistent.
 */
export function ScreenShell({
  title,
  active,
  headerRight,
  children,
}: {
  title: string;
  active?: NavKey;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-gray-50">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/90 px-5 py-4 backdrop-blur">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {headerRight}
      </header>

      <main className="flex-1 space-y-5 px-5 py-5 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md items-center justify-around border-t border-gray-100 bg-white px-2 py-2">
        {NAV.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-xs font-medium ${
                isActive ? "text-violet-600" : "text-gray-400"
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
