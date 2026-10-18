import { execSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";

/** Generates SQL migrations from the Drizzle schema if none exist yet (tests need them to build a DB). */
export default function setup() {
  const has = existsSync("drizzle") && readdirSync("drizzle").some((f) => f.endsWith(".sql"));
  if (!has) execSync("npx drizzle-kit generate", { stdio: "inherit" });
}
