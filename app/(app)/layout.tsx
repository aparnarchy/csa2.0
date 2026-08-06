import { MobileGestures } from "@/components/kit";

/**
 * Wraps every authenticated screen with the standard mobile gestures (swipe
 * from the left edge to go back, pull-down-at-the-top to refresh). Scoped to
 * this route group only — the (auth) screens (login/signup/reset) don't get
 * it, since there's nothing there to refresh and "back" already means "leave
 * the flow" via their own links.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <MobileGestures>{children}</MobileGestures>;
}
