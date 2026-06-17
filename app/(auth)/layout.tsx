import type { Viewport } from "next";

/**
 * Auth screens (login / signup / reset) are light gray, not the app's lavender,
 * so the mobile browser top bar should match gray here — overrides the root
 * lavender theme-color for these routes only.
 */
export const viewport: Viewport = {
  themeColor: "#F9FAFB",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
