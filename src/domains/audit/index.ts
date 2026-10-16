import type { Db } from "@/infrastructure/db/client";
import { auditLogs } from "@/infrastructure/db/schema";

export type AuditInput = {
  actorUserId: string | null; action: string; entityType: string; entityId?: string | null;
  brandId?: string | null; before?: unknown; after?: unknown;
};
type Writer = Pick<Db, "insert">;
export async function writeAudit(db: Writer, e: AuditInput): Promise<void> {
  await db.insert(auditLogs).values({
    actorUserId: e.actorUserId, action: e.action, entityType: e.entityType, entityId: e.entityId ?? null,
    brandId: e.brandId ?? null, metadata: null, beforeJson: e.before ?? null, afterJson: e.after ?? null, createdAt: new Date(),
  });
}
