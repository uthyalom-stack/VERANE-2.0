import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { infrastructureSmokeTests, type InfrastructureSmokeTest, type NewInfrastructureSmokeTest } from "../schema";

export interface ISmokeTestRepository {
  create(data: NewInfrastructureSmokeTest): Promise<InfrastructureSmokeTest>;
  findByKey(testKey: string): Promise<InfrastructureSmokeTest | null>;
  deleteByKey(testKey: string): Promise<boolean>;
}

export class DrizzleSmokeTestRepository implements ISmokeTestRepository {
  constructor(private readonly db: Database) {}

  async create(data: NewInfrastructureSmokeTest): Promise<InfrastructureSmokeTest> {
    const inserted = await this.db.insert(infrastructureSmokeTests).values(data).returning();
    return inserted[0];
  }

  async findByKey(testKey: string): Promise<InfrastructureSmokeTest | null> {
    const records = await this.db
      .select()
      .from(infrastructureSmokeTests)
      .where(eq(infrastructureSmokeTests.testKey, testKey))
      .limit(1);

    return records[0] ?? null;
  }

  async deleteByKey(testKey: string): Promise<boolean> {
    const deleted = await this.db
      .delete(infrastructureSmokeTests)
      .where(eq(infrastructureSmokeTests.testKey, testKey))
      .returning();

    return deleted.length > 0;
  }
}
