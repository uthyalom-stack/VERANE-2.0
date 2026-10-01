import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export function createDatabaseConnection(options?: { url?: string; authToken?: string }) {
  const url = options?.url || process.env.DATABASE_URL || "file:local.db";
  const authToken = options?.authToken || process.env.DATABASE_AUTH_TOKEN;

  const client = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

  return drizzle(client, { schema });
}

export const db = createDatabaseConnection();
export type Database = ReturnType<typeof createDatabaseConnection>;
