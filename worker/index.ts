/**
 * Custom Worker entry: wraps the OpenNext-generated worker and adds a `scheduled` handler.
 * The cron trigger (wrangler.jsonc) calls our own authenticated route /api/cron/tick, so background jobs run through the
 * exact same code path/config as requests (DB, env, providers) and every job stays idempotent.
 * UNVERIFIED until deployed: confirm the generated worker's export shape for your @opennextjs/cloudflare version.
 */
// @ts-expect-error generated at build time by `opennextjs-cloudflare build`
import handler from "../.open-next/worker.js";

type Env = { CRON_SECRET?: string; APP_URL?: string } & Record<string, unknown>;

export default {
  fetch: (req: Request, env: Env, ctx: unknown) => (handler as { fetch: (...a: unknown[]) => Promise<Response> }).fetch(req, env, ctx),
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const base = env.APP_URL;
    if (!base || !env.CRON_SECRET) { console.error("[cron] APP_URL/CRON_SECRET missing; skipping"); return; }
    const req = new Request(`${base}/api/cron/tick`, { method: "POST", headers: { Authorization: `Bearer ${env.CRON_SECRET}` } });
    ctx.waitUntil((handler as { fetch: (...a: unknown[]) => Promise<Response> }).fetch(req, env, ctx).then(async (r) => { if (!r.ok) console.error("[cron] tick failed", r.status); }));
  },
};
// Durable/other bindings re-exported by OpenNext (e.g. DOQueueHandler) must be re-exported here if you enable those features.
