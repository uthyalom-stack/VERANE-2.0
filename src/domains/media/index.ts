import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/infrastructure/db/client";
import { mediaAssets } from "@/infrastructure/db/schema";
import type { MediaStorage } from "@/infrastructure/storage";
import { AppError } from "@/lib/errors";
import { sha256Hex } from "@/lib/crypto";
import { validateUpload } from "./sniff";
export { sniff, validateUpload, LIMITS, type Sniffed } from "./sniff";
import { assertCan, scopedBrandIds, type Actor } from "@/domains/authorization";
import { writeAudit } from "@/domains/audit";

/** Idempotent on `uploadId`: a client retry after a network failure overwrites the same key and returns the same row. */
export async function storeUpload(db: Db, storage: MediaStorage, actor: Actor, input: { bytes: Uint8Array; uploadId: string; brandId: string | null; altText?: string | null }) {
  assertCan(actor, "media.write", input.brandId);
  const s = validateUpload(input.bytes, input.bytes.byteLength);
  if (s.kind === "image" && !input.altText?.trim()) throw new AppError("VALIDATION", "Alt text is required for images");
  const key = `${s.kind}/${(await sha256Hex(`${actor.userId}:${input.uploadId}`)).slice(0, 32)}.${s.ext}`;
  const [existing] = await db.select().from(mediaAssets).where(eq(mediaAssets.storageKey, key));
  if (existing) return existing;
  await storage.put(key, new Uint8Array(input.bytes).buffer as ArrayBuffer, s.mime);
  const [row] = await db.insert(mediaAssets).values({ brandId: input.brandId, storageKey: key, kind: s.kind, mimeType: s.mime, byteSize: input.bytes.byteLength, width: s.width ?? null, height: s.height ?? null, altText: input.altText?.trim() || null, uploadedBy: actor.userId }).onConflictDoNothing().returning();
  await writeAudit(db, { actorUserId: actor.userId, action: "media.upload", entityType: "media", entityId: row?.id ?? key, brandId: input.brandId, after: { key, kind: s.kind, bytes: input.bytes.byteLength } });
  return row ?? (await db.select().from(mediaAssets).where(eq(mediaAssets.storageKey, key)))[0]!;
}

export async function listMedia(db: Db, actor: Actor, limit = 60) {
  const scope = scopedBrandIds(actor, "media.write");
  if (scope !== "all" && scope.length === 0) return [];
  const q = db.select().from(mediaAssets).orderBy(desc(mediaAssets.createdAt)).limit(limit);
  return scope === "all" ? q : q.where(inArray(mediaAssets.brandId, scope));
}
export async function updateAlt(db: Db, actor: Actor, id: string, altText: string) {
  const [m] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)); if (!m) throw new AppError("NOT_FOUND", "Media not found");
  assertCan(actor, "media.write", m.brandId);
  await db.update(mediaAssets).set({ altText }).where(and(eq(mediaAssets.id, id)));
}
