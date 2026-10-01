import { Database } from "@/infrastructure/database/client";
import { auditLogs } from "@/infrastructure/database/schema";
import { logger } from "@/lib/logger";

const SENSITIVE_FIELDS = new Set(["password", "token", "secret", "passwordHash", "authorization", "cookie"]);

function sanitizeMetadata(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeMetadata);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.has(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class AuditService {
  constructor(private db: Database) {}

  async log(params: {
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    brandId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    const sanitizedMeta = params.metadata ? sanitizeMetadata(params.metadata) : null;
    const metadataStr = sanitizedMeta ? JSON.stringify(sanitizedMeta) : null;

    const id = crypto.randomUUID();

    await this.db.insert(auditLogs).values({
      id,
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      brandId: params.brandId ?? null,
      metadata: metadataStr,
    });

    logger.info("Audit log entry created", {
      auditLogId: id,
      action: params.action,
      entityType: params.entityType,
      actorUserId: params.actorUserId,
    });
  }
}
