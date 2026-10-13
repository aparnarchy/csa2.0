/**
 * Stamps this build with a version tag (public/version.json). next.config.mjs
 * bakes the same tag into the app's code, and lib/version.ts compares the two:
 * an app left open across a deploy sees the live file change and reloads
 * itself onto the new version, instead of calling server functions the new
 * deploy no longer has. Runs before every build (see package.json).
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const v = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
writeFileSync(join(root, "public", "version.json"), JSON.stringify({ v }) + "\n");
console.log(`Stamped build version ${v}`);
