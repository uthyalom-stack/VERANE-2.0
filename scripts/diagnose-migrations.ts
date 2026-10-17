import { readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { createDb } from "@/infrastructure/db/client";

const dbPath = path.resolve("migration-diagnostic.db");
rmSync(dbPath, { force: true });
const { client } = createDb(`file:${dbPath}`);

try {
  const files = readdirSync("drizzle").filter((name) => /^\\d{4}_.+\\.sql$/.test(name)).sort();
  for (const file of files) {
    const statements = readFileSync(path.join("drizzle", file), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const [index, statement] of statements.entries()) {
      try {
        await client.execute({ sql: statement });
      } catch (error) {
        console.error(`Migration diagnostic failed: ${file}, statement ${index + 1}/${statements.length}`);
        console.error(statement);
        throw error;
      }
    }
    console.log(`Applied ${file} (${statements.length} statements)`);
  }
  console.log("All committed SQL migration statements applied successfully.");
} finally {
  client.close();
  rmSync(dbPath, { force: true });
}
