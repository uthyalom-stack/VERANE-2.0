import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { getEnv } from "@/lib/env";

export type Db = LibSQLDatabase<typeof schema>;

export function createDb(url: string, authToken?: string): { db: Db; client: Client } {
  // `@libsql/client` resolves to the web/HTTP build under the `workerd` export condition.
  const client = createClient({ url, authToken: authToken || undefined });
  return { db: drizzle(client, { schema, casing: "snake_case" }), client };
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
