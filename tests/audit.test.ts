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

  it("should record administrative actions and sanitize sensitive fields in metadata including case and snake/camel variants", async () => {
    await auditService.log({
      actorUserId: "admin_123",
      action: "admin.password_reset",
      entityType: "user",
      entityId: "target_456",
      metadata: {
        reason: "User requested reset",
        password: "NewRawPassword123!",
        passwordHash: "hash_value_123",
        password_hash: "hash_value_456",
        token: "bearer-token-1",
        accessToken: "access-token-2",
        access_token: "access-token-3",
        secret: "super-secret-token",
        authorization: "Bearer secret",
        apiKey: "api-key-1",
        api_key: "api-key-2",
        cookie: "session=123",
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
    const parsed = JSON.parse(log.metadata!);

    expect(parsed.reason).toBe("User requested reset");
    expect(parsed.password).toBe("[REDACTED]");
    expect(parsed.passwordHash).toBe("[REDACTED]");
    expect(parsed.password_hash).toBe("[REDACTED]");
    expect(parsed.token).toBe("[REDACTED]");
    expect(parsed.accessToken).toBe("[REDACTED]");
    expect(parsed.access_token).toBe("[REDACTED]");
    expect(parsed.secret).toBe("[REDACTED]");
    expect(parsed.authorization).toBe("[REDACTED]");
    expect(parsed.apiKey).toBe("[REDACTED]");
    expect(parsed.api_key).toBe("[REDACTED]");
    expect(parsed.cookie).toBe("[REDACTED]");
    expect(parsed.nested.token).toBe("[REDACTED]");
    expect(parsed.nested.safeField).toBe("this is public");
  });
});
