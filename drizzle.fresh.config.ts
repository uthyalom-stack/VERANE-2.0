import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/infrastructure/db/schema/index.ts",
  out: "./drizzle_generated",
  casing: "snake_case",
});
