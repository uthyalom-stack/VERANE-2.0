import { describe, it, expect, beforeAll } from "vitest";
import { createDatabaseConnection } from "../src/infrastructure/database/client";
import { DrizzleSmokeTestRepository } from "../src/infrastructure/database/repositories/smoke-test-repository";
import { sql } from "drizzle-orm";

describe("Database Infrastructure Smoke Test", () => {
  const db = createDatabaseConnection({ url: "file:test-local.db" });
  const repository = new DrizzleSmokeTestRepository(db);

  beforeAll(async () => {
    // Ensure table exists for smoke testing
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS infrastructure_smoke_tests (
        id TEXT PRIMARY KEY NOT NULL,
        test_key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
  });

  it("should write, read, and verify database record via repository", async () => {
    const testKey = `test-key-${Date.now()}`;
    const testValue = "VÉRANE 2.0 Infrastructure Test Value";

    // 1. Write
    const created = await repository.create({
      id: `id-${Date.now()}`,
      testKey,
      value: testValue,
    });

    expect(created).toBeDefined();
    expect(created.testKey).toBe(testKey);
    expect(created.value).toBe(testValue);

    // 2. Read
    const found = await repository.findByKey(testKey);
    expect(found).not.toBeNull();
    expect(found?.value).toBe(testValue);

    // 3. Delete & Verify
    const deleted = await repository.deleteByKey(testKey);
    expect(deleted).toBe(true);

    const afterDelete = await repository.findByKey(testKey);
    expect(afterDelete).toBeNull();
  });
});
