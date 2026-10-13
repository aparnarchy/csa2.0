/**
 * Keeps an open app on the live version. CLIENT-SIDE.
 *
 * Every deploy renames the server functions the screens call, so an app left
 * open (or sitting in the phone's background) across a deploy keeps calling
 * names the server no longer has: screens load empty, stick, or crash
 * (2026-10-13 incident). Each build carries a version tag
 * (scripts/stamp-version.mjs → public/version.json, baked in here at build
 * time); when the live file's tag differs, this app is out of date and loads
 * the page afresh. The check reads a static file, so it costs no Worker time.
 */

const MINE = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev";
const enabled = MINE !== "dev" && process.env.NODE_ENV === "production";

let outdated = false;
let inFlight: Promise<boolean> | null = null;

/** Has a newer version gone live since this app loaded? */
export function checkVersion(): Promise<boolean> {
  if (!enabled || outdated) return Promise.resolve(outdated);
  inFlight ??= fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ v?: string }>) : null))
    .then((live: { v?: string } | null) => {
      outdated = !!live?.v && live.v !== MINE;
      return outdated;
    })
    .catch(() => false) // offline or cut off: assume current, check again later
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function isOutdated(): boolean {
  return outdated;
}

/** Load the current page afresh, on the live version. */
export function reloadToLatest(): void {
  window.location.reload();
}
