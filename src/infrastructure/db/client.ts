import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { getEnv } from "@/lib/env";

export type Db = LibSQLDatabase<typeof schema>;

const localDbInstances = new WeakSet<object>();
/** True only for embedded SQLite connections; remote libSQL writes must remain concurrent. */
export function isLocalDb(db: Db): boolean {
  return localDbInstances.has(db as object);
}

export function createDb(url: string, authToken?: string): { db: Db; client: Client } {
  // `@libsql/client` resolves to the web/HTTP build under the `workerd` export condition.
  const client = createClient({ url, authToken: authToken || undefined });
  const db = drizzle(client, { schema, casing: "snake_case" });
  if (url.startsWith("file:")) localDbInstances.add(db as object);
  return { db, client };
}

let singleton: Db | undefined;
/** Primary (authoritative) database. */
export function getDb(): Db {
  if (!singleton) {
    const env = getEnv();
    singleton = createDb(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN).db;
  }
  return singleton;
}
export { schema };
