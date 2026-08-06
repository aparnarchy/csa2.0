/**
 * Weekly check-in rollover endpoint.
 *
 * POST (or GET) /api/cron/weekly  with header  Authorization: Bearer <CRON_SECRET>
 *
 * Rolls the active week forward and assigns 2 questions to every active employee.
 * The app is also self-healing on read (see lib/scheduler.ensureUserAssignments),
 * so this endpoint isn't strictly required for correctness — it just guarantees
 * everyone's week is prepared up front, even users who don't log in, and gives an
 * external scheduler (the cron worker in /cron-worker, or any pinger) something to
 * call on a Monday.
 *
 * Secured by a shared secret so it can't be triggered anonymously.
 */

import { getRequestContext } from "@cloudflare/next-on-pages";
import { NextResponse } from "next/server";
import { runWeeklyRollover } from "@/lib/scheduler";

export const runtime = "edge";

function authorized(request: Request, secret: string | undefined): boolean {
  if (!secret) return false; // no secret configured → refuse rather than run open
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function handle(request: Request) {
  const { env } = getRequestContext();
  const secret = (env as unknown as { CRON_SECRET?: string }).CRON_SECRET;
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await runWeeklyRollover(env.DB);
  return NextResponse.json({ ok: true, ...summary });
}

export const POST = handle;
export const GET = handle;
