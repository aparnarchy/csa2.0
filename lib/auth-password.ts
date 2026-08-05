/**
 * Workers-native password hashing for better-auth.
 *
 * WHY THIS EXISTS:
 * better-auth's default hasher is pure-JS scrypt (@noble/hashes, N=16384 r=16).
 * On Cloudflare Workers that runs single-threaded in the isolate and costs
 * hundreds of ms of CPU per login — far over the free plan's per-request CPU
 * budget, so sign-in/sign-up return HTTP 503 (Cloudflare error 1102). See the
 * diagnosis: cheap routes (get-session) work, anything that hashes a password
 * fails.
 *
 * This replaces it with PBKDF2 via the native WebCrypto API (crypto.subtle),
 * which runs as fast native code and whose cost we can dial with ITERATIONS to
 * stay inside the CPU budget while remaining a standard, salted, slow KDF.
 *
 * Wired in via `emailAndPassword.password = { hash, verify }` in lib/auth.ts.
 *
 * HASH FORMAT: `pbkdf2$<iterations>$<saltHex>$<keyHex>`. The leading tag lets
 * verify() tell new hashes apart from any pre-existing better-auth scrypt hash
 * (format `saltHex:keyHex`), which still verifies through the legacy fallback
 * so old accounts keep working until they're re-hashed.
 */

import { verifyPassword as legacyScryptVerify } from "better-auth/crypto";

// Tuned to fit the Workers free-tier per-request CPU budget. Raise this once on
// the paid plan (higher CPU limit) for a bigger security margin.
const ITERATIONS = 100_000;
const KEYLEN_BITS = 256; // 32-byte derived key
const SALT_BYTES = 16;
const DIGEST = "SHA-256";

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: DIGEST },
    key,
    KEYLEN_BITS,
  );
  return toHex(new Uint8Array(bits));
}

/** Hash a new password. Called by better-auth on sign-up / password change. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${key}`;
}

/** Verify a password against a stored hash. Called by better-auth on sign-in. */
export async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  if (hash.startsWith("pbkdf2$")) {
    const [, iterStr, saltHex, keyHex] = hash.split("$");
    const iterations = Number(iterStr);
    if (!iterStr || !saltHex || !keyHex || !Number.isFinite(iterations)) return false;
    const derived = await derive(password, fromHex(saltHex), iterations);
    return timingSafeEqualHex(derived, keyHex);
  }
  // Legacy better-auth scrypt hash ("saltHex:keyHex") — slow path, kept so
  // pre-existing accounts (e.g. the owner's) still work until re-hashed.
  return legacyScryptVerify({ hash, password });
}

/** Length-independent constant-time compare of two equal-length hex strings. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
