/**
 * App wording. The actual text lives in the owner-editable /copy/*.txt files;
 * scripts/build-copy.mjs compiles them into copy.generated.ts, which this file
 * re-exports. Screens import { COPY, fill } from "@/lib/copy".
 *
 *   COPY.login.pageTitle                       → "Sign in to CSA"
 *   fill(COPY.checkin.doneNiceWorkTitle, { name }) → "Nice work, Aparna!"
 */
import { COPY } from "./copy.generated";

export { COPY };

/** Replace {placeholders} in a copy string with values. */
export function fill(s: string, vars: Record<string, string | number> = {}): string {
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
