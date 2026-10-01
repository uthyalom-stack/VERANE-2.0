"use server";

import { db } from "@/infrastructure/database/client";
import { DrizzleSmokeTestRepository } from "@/infrastructure/database/repositories/smoke-test-repository";
import { logger } from "@/lib/logger";

export async function runInfrastructureSmokeCheck() {
  logger.info("Executing infrastructure smoke check via Server Action");
  const repo = new DrizzleSmokeTestRepository(db);
  const testKey = `sa-test-${Date.now()}`;

  await repo.create({
    id: `id-${Date.now()}`,
    testKey,
    value: "Server Action Smoke Value",
  });

  const record = await repo.findByKey(testKey);
  if (!record) {
    throw new Error("Smoke check failed: record not found");
  }

  await repo.deleteByKey(testKey);

  return {
    success: true,
    testKey,
    value: record.value,
  };
}
