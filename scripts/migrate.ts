import { createDb } from "../src/infrastructure/db/client";
import { applyMigrations } from "../src/infrastructure/db/migrate";
import { reconcileRbac } from "../src/domains/authorization/seed";

const url = process.env.DATABASE_URL ?? "file:./local.db";
const { db } = createDb(url, process.env.DATABASE_AUTH_TOKEN);
await applyMigrations(db);
await reconcileRbac(db);
console.log(`Migrations applied and RBAC reconciled on ${url.replace(/\/\/.*@/, "//***@")}`);
