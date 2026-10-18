import { rmSync } from "node:fs";
const url = process.env.DATABASE_URL ?? "file:./local.db";
if (!url.startsWith("file:")) throw new Error("Refusing to reset a non-local database");
rmSync(url.slice(5), { force: true });
console.log("Local database removed. Run: npm run db:migrate && npm run db:seed");
