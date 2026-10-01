import { NextResponse } from "next/server";
import { db } from "@/infrastructure/database/client";
import { DrizzleSmokeTestRepository } from "@/infrastructure/database/repositories/smoke-test-repository";
import { formatErrorForClient } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    logger.info("Executing API Route Handler Smoke Check");
    const repo = new DrizzleSmokeTestRepository(db);
    const testKey = `api-test-${Date.now()}`;

    await repo.create({
      id: `id-${Date.now()}`,
      testKey,
      value: "API Route Smoke Value",
    });

    const record = await repo.findByKey(testKey);
    if (!record) {
      return NextResponse.json({ error: { message: "Record missing", code: "SMOKE_FAILED" } }, { status: 500 });
    }

    await repo.deleteByKey(testKey);

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      verifiedKey: testKey,
    });
  } catch (error) {
    logger.error("Smoke test API error", { error });
    const formatted = formatErrorForClient(error);
    return NextResponse.json(formatted, { status: 500 });
  }
}
