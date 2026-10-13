"use client";

/**
 * Shown in place of any signed-in screen that crashes, instead of the browser's
 * dead "Application error" page (2026-10-12: a user tapping around hit one and
 * was stuck). "Try again" re-renders the screen with fresh server data; "Go to
 * my dashboard" is a full page load, so it recovers even if the app's client
 * state is what broke.
 */
import { useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/kit";
import { COPY } from "@/lib/copy";
import { checkVersion, reloadToLatest } from "@/lib/version";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
    // Most often the app is simply older than the live deploy: load it afresh.
    void checkVersion().then((outdated) => outdated && reloadToLatest());
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center bg-lav-bg px-6 text-center">
      <Mascot state="sad" size={140} />
      <h1 className="mt-5 font-display text-[24px] font-black leading-tight text-brand [text-wrap:balance]">
        {COPY.shared.errorTitle}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-3">{COPY.shared.errorBody}</p>
      <button
        type="button"
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
        className="mt-6 w-full rounded-2xl bg-brand py-3.5 font-display text-sm font-black text-white transition active:scale-[0.98]"
      >
        {COPY.shared.errorRetry}
      </button>
      <a
        href="/dashboard"
        className="mt-2 w-full rounded-2xl bg-lav-soft py-3.5 font-display text-sm font-black text-brand transition active:scale-[0.98]"
      >
        {COPY.shared.errorHome}
      </a>
    </div>
  );
}
