import { createClient } from "@libsql/client";
const url = process.env.ANALYTICS_DATABASE_URL;
if (!url) throw new Error("ANALYTICS_DATABASE_URL is not set (analytics store is optional)");
const c = createClient({ url, authToken: process.env.ANALYTICS_DATABASE_AUTH_TOKEN });
await c.execute(`CREATE TABLE IF NOT EXISTS analytics_events (id text PRIMARY KEY, name text NOT NULL, session_hash text, brand_id text, entity_type text, entity_id text, campaign text, props_json text, created_at integer NOT NULL DEFAULT (unixepoch()*1000))`);
await c.execute(`CREATE INDEX IF NOT EXISTS analytics_name_idx ON analytics_events (name, created_at)`);
console.log("Analytics table ready");
