"use client";

import { useEffect } from "react";
import { checkVersion, isOutdated, reloadToLatest } from "@/lib/version";

const EVERY_MS = 5 * 60 * 1000;

/** Typing into a field: never reload under someone mid-sentence. */
function busyTyping(): boolean {
  const el = document.activeElement;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);
}

/**
 * Moves an open app onto a new deploy (see lib/version.ts) at a calm moment:
 * - coming back to the app (from another app or the lock screen): reload
 *   straight away, since nothing is mid-tap;
 * - tapping a link or pressing back once it's known to be out of date: load
 *   that screen afresh instead of moving within the old version.
 * - a server-function call answered by the wrong kind of reply (below).
 * Checks on return, and every few minutes while open. Renders nothing.
 */
export function VersionWatcher() {
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      if ((await checkVersion()) && !busyTyping()) reloadToLatest();
    };
    // Capture phase, so this runs before the in-app router handles the tap.
    const onClick = (e: MouseEvent) => {
      if (!isOutdated() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== window.location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      window.location.assign(a.href);
    };
    // The URL has already changed to the earlier screen; load it afresh.
    const onPopState = () => {
      if (isOutdated()) reloadToLatest();
    };

    // A server function the live deploy no longer has doesn't fail: the
    // server answers with a normal page instead of the function's reply, and
    // the call quietly returns nothing (screens load empty or stick). Spot
    // that reply on any server-function call and, if the app is outdated,
    // reload. Only reads the response; never changes it.
    const realFetch = window.fetch;
    window.fetch = async (input, init) => {
      const res = await realFetch(input, init);
      try {
        const isServerFn = new Headers(init?.headers).has("Next-Action");
        const type = res.headers.get("content-type") ?? "";
        if (isServerFn && !type.startsWith("text/x-component")) {
          void checkVersion().then((outdated) => outdated && reloadToLatest());
        }
      } catch {
        // never let the check break the real request
      }
      return res;
    };

    const timer = setInterval(() => void checkVersion(), EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    void checkVersion();
    return () => {
      window.fetch = realFetch;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);
  return null;
}
