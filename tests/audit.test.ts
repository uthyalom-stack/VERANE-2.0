import { describe, it, expect, beforeEach } from "vitest";
import { createDatabaseConnection } from "../src/infrastructure/database/client";
import { AuditService } from "../src/domains/audit/audit-service";
import { auditLogs } from "../src/infrastructure/database/schema";
import { eq } from "drizzle-orm";

interface SqliteSessionClient {
  session: {
    client: {
      execute: (sql: string) => Promise<unknown>;
    };
  };
}

describe("Audit Logging", () => {
  const db = createDatabaseConnection({ url: "file::memory:" });
  const auditService = new AuditService(db);

  beforeEach(async () => {
    const client = (db as unknown as SqliteSessionClient).session.client;
    await client.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY NOT NULL,
        actor_user_id TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        brand_id TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL
      );
    `);
  });

  it("should record administrative actions and sanitize sensitive fields in metadata", async () => {
    await auditService.log({
      actorUserId: "admin_123",
      action: "admin.password_reset",
      entityType: "user",
      entityId: "target_456",
      metadata: {
        reason: "User requested reset",
        password: "NewRawPassword123!",
        secret: "super-secret-token",
        nested: {
          token: "bearer-token-abc",
          safeField: "this is public",
        },
      },
    });

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, "admin.password_reset"));
    expect(logs.length).toBe(1);

    const log = logs[0];
    expect(log.actorUserId).toBe("admin_123");
    expect(log.entityType).toBe("user");
    expect(log.entityId).toBe("target_456");

    expect(log.metadata).toBeDefined();
    const parsedMetadata = JSON.parse(log.metadata!);

    expect(parsedMetadata.reason).toBe("User requested reset");
    expect(parsedMetadata.password).toBe("[REDACTED]");
    expect(parsedMetadata.secret).toBe("[REDACTED]");
    expect(parsedMetadata.nested.token).toBe("[REDACTED]");
    expect(parsedMetadata.nested.safeField).toBe("this is public");
  });
});
