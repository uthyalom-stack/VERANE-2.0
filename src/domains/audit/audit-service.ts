import { Database } from "@/infrastructure/database/client";
import { auditLogs } from "@/infrastructure/database/schema";
import { logger } from "@/lib/logger";

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "token",
  "accesstoken",
  "access_token",
  "secret",
  "authorization",
  "apikey",
  "api_key",
  "cookie",
]);

function normalizeKey(key: string): string {
  return key.replace(/[-_]/g, "").toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (SENSITIVE_KEYS.has(key.toLowerCase()) || SENSITIVE_KEYS.has(normalized)) {
    return true;
  }
  for (const sensitiveKey of SENSITIVE_KEYS) {
    if (normalized.includes(sensitiveKey)) {
      return true;
    }
  }
  return false;
}

function sanitizeMetadata(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeMetadata);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
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
