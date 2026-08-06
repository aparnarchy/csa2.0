/**
 * csa2-cron — a one-purpose Cloudflare Worker.
 *
 * On its cron schedule (see wrangler.toml) it calls the app's weekly rollover
 * endpoint with the shared secret. That's all it does; the real work lives in the
 * app (lib/scheduler.runWeeklyRollover) so there's no duplicated logic here.
 */

export interface Env {
  APP_URL: string;
  CRON_SECRET: string;
}

async function trigger(env: Env): Promise<Response> {
  const url = `${env.APP_URL.replace(/\/$/, "")}/api/cron/weekly`;
  return fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${env.CRON_SECRET}` },
  });
}

export default {
  // Runs on the cron schedule.
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(trigger(env).then(() => undefined));
  },

  // Also allow a manual GET to the worker to fire it on demand (handy for testing).
  async fetch(_request: Request, env: Env): Promise<Response> {
    const res = await trigger(env);
    const body = await res.text();
    return new Response(body, { status: res.status, headers: { "content-type": "application/json" } });
  },
};
