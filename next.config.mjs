import { readFileSync } from "node:fs";

if (process.env.NODE_ENV === "development") {
  const { setupDevPlatform } = await import("@cloudflare/next-on-pages/next-dev");
  await setupDevPlatform();
}

// The version tag scripts/stamp-version.mjs wrote for this build; baked into
// the app so lib/version.ts can spot when a newer deploy has gone live.
let buildVersion = "dev";
try {
  buildVersion = JSON.parse(readFileSync(new URL("./public/version.json", import.meta.url), "utf8")).v;
} catch {
  // no stamp (e.g. plain `next dev`): the version check stays off
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_BUILD_VERSION: buildVersion },
};

export default nextConfig;
