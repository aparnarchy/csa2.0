"use client";

import { useRef } from "react";

/**
 * Tracks the check-in writes (answers, skips) made during a flow so the flow
 * only finishes once they've all landed. Without this a failed write (e.g. a
 * "Worker exceeded resource limits" blip) went unnoticed: the screen said
 * "Saved", moved on, and the dashboard — still seeing that question as due —
 * bounced the user straight back into the check-in.
 *
 * `save(key, run)` starts a write; a later save for the same key (re-answering)
 * replaces it. `flush()` waits for every write, retries any that failed once,
 * and resolves false if something still didn't save, so the caller can stay
 * put and offer "tap to try again" (calling flush again).
 */
export function useSaveQueue() {
  const ops = useRef(new Map<string, { run: () => Promise<unknown>; p: Promise<unknown> }>());

  function start(run: () => Promise<unknown>): Promise<unknown> {
    const p = run();
    p.catch(() => {}); // handled in flush — don't log an unhandled rejection meanwhile
    return p;
  }

  function save(key: string, run: () => Promise<unknown>) {
    ops.current.set(key, { run, p: start(run) });
  }

  function has(key: string) {
    return ops.current.has(key);
  }

  async function flush(): Promise<boolean> {
    const results = await Promise.allSettled(
      [...ops.current.entries()].map(async ([key, op]) => {
        try {
          await op.p;
        } catch {
          const p = start(op.run);
          ops.current.set(key, { run: op.run, p });
          await p;
        }
      }),
    );
    return results.every((r) => r.status === "fulfilled");
  }

  return { save, has, flush };
}
