import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const infrastructureSmokeTests = sqliteTable("infrastructure_smoke_tests", {
  id: text("id").primaryKey(),
  testKey: text("test_key").notNull().unique(),
  value: text("value").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type InfrastructureSmokeTest = typeof infrastructureSmokeTests.$inferSelect;
export type NewInfrastructureSmokeTest = typeof infrastructureSmokeTests.$inferInsert;
