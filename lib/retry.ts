/**
 * Client-side safety net for server calls. On the free Cloudflare plan a
 * request can be cut off mid-flight ("Worker exceeded resource limits"); the
 * call then rejects. Retrying once after a short pause clears most of these,
 * since the next request usually lands on a warm worker. Callers still handle
 * the final failure — never leave a rejection unhandled, or a screen sits on
 * its loading state forever.
 */
export async function withRetry<T>(call: () => Promise<T>, retries = 1, delayMs = 700): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((r) => setTimeout(r, delayMs));
    return withRetry(call, retries - 1, delayMs * 2);
  }
}

/** For refreshes of data already on screen: on final failure, keep what's shown. */
export const keepCurrent = () => {};
