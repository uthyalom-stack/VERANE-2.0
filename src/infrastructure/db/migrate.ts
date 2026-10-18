import { readFileSync } from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { Db } from "./client";

/** Node-only (scripts/tests). On Workers, run migrations from CI/CLI against Layerbase, never at request time. */
export async function applyMigrations(db: Db, root = process.cwd()): Promise<void> {
  await migrate(db, { migrationsFolder: path.join(root, "drizzle") });
  const fts = readFileSync(path.join(root, "src/infrastructure/db/fts.sql"), "utf8");
  for (const stmt of fts.split(";").map((s) => s.replace(/--.*$/gm, "").trim()).filter(Boolean)) {
    await db.run(stmt as never);
  }
}
