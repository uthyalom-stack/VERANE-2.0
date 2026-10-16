import { eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/infrastructure/db/client";
import { inventoryLevels, inventoryTransactions, productVariants, products } from "@/infrastructure/db/schema";
import { AppError } from "@/lib/errors";
import { assertCan, type Actor } from "@/domains/authorization";
import { writeAudit } from "@/domains/audit";

export type StockLine = { variantId: string; quantity: number };
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const affected = (r: unknown): number => (r as { rowsAffected?: number }).rowsAffected ?? 0;

function isSqliteBusy(error: unknown): boolean {
  const e = error as { code?: string; rawCode?: number; message?: string };
  return e?.code === "SQLITE_BUSY" || e?.rawCode === 5 || /database is locked/i.test(e?.message ?? "");
}

async function retryBusy<T>(work: () => Promise<T>, attempts = 30): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await work(); }
    catch (error) {
      if (!isSqliteBusy(error) || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1) + Math.floor(Math.random() * 25)));
    }
  }
}

/**
 * Concurrency model: every stock mutation is ONE conditional UPDATE (compare-and-set on available stock),
 * so two buyers can never both pass the check, regardless of transaction isolation. Each mutation also
 * inserts a ledger row carrying an idempotency key; a UNIQUE conflict means "already applied" (retried
 * webhook) and the mutation is skipped. Both run inside a transaction so they succeed or fail together.
 */
async function claimKey(tx: Tx, key: string, row: typeof inventoryTransactions.$inferInsert): Promise<boolean> {
  const r = await tx.insert(inventoryTransactions).values({ ...row, idempotencyKey: key }).onConflictDoNothing();
  return affected(r) > 0;
}

export async function getAvailability(db: Db, variantIds: string[]): Promise<Map<string, { available: number; allowBackorder: boolean }>> {
  const out = new Map<string, { available: number; allowBackorder: boolean }>();
  if (variantIds.length === 0) return out;
  const rows = await db.select().from(inventoryLevels).where(inArray(inventoryLevels.variantId, variantIds));
  for (const r of rows) out.set(r.variantId, { available: r.onHand - r.reserved, allowBackorder: r.allowBackorder });
  return out;
}

export async function setInitialStock(db: Db, variantId: string, quantity: number, actorUserId: string | null = null): Promise<void> {
  if (!Number.isInteger(quantity) || quantity < 0) throw new AppError("VALIDATION", "Invalid quantity");
  await retryBusy(() => db.transaction(async (tx) => {
    const fresh = await claimKey(tx, `initial:${variantId}`, { variantId, type: "initial", onHandDelta: quantity, reason: "Initial stock", actorUserId, referenceType: "manual" });
    if (!fresh) return;
    await tx.insert(inventoryLevels).values({ variantId, onHand: quantity, reserved: 0 })
      .onConflictDoUpdate({ target: inventoryLevels.variantId, set: { onHand: quantity, reserved: 0, updatedAt: new Date() } });
  }, { behavior: "immediate" }));
}

export async function reserveStock(db: Db, lines: StockLine[], ref: string): Promise<void> {
  await retryBusy(() => db.transaction(async (tx) => {
    for (const l of lines) {
      assertQty(l.quantity);
      const fresh = await claimKey(tx, `reserve:${ref}:${l.variantId}`, {
        variantId: l.variantId, type: "reserve", reservedDelta: l.quantity, referenceType: "order", referenceId: ref,
      });
      if (!fresh) continue; // already reserved for this reference
      const r = await tx.run(sql`UPDATE inventory_levels SET reserved = reserved + ${l.quantity}, updated_at = (unixepoch()*1000)
        WHERE variant_id = ${l.variantId} AND (allow_backorder = 1 OR on_hand - reserved >= ${l.quantity})`);
      if (affected(r) === 0) throw new AppError("OUT_OF_STOCK", "An item in your bag is no longer available in the requested quantity", { variantId: l.variantId });
    }
  }, { behavior: "immediate" }));
}

export async function releaseReservation(db: Db, lines: StockLine[], ref: string): Promise<void> {
  await retryBusy(() => db.transaction(async (tx) => {
    for (const l of lines) {
      const reserved = await tx.select().from(inventoryTransactions)
        .where(eq(inventoryTransactions.idempotencyKey, `reserve:${ref}:${l.variantId}`));
      if (reserved.length === 0) continue; // never reserved
      const sold = await tx.select().from(inventoryTransactions).where(eq(inventoryTransactions.idempotencyKey, `sale:${ref}:${l.variantId}`));
      if (sold.length > 0) continue; // already converted to a sale; nothing to release
      const fresh = await claimKey(tx, `release:${ref}:${l.variantId}`, {
        variantId: l.variantId, type: "release", reservedDelta: -l.quantity, referenceType: "order", referenceId: ref,
      });
      if (!fresh) continue;
      await tx.run(sql`UPDATE inventory_levels SET reserved = reserved - ${l.quantity}, updated_at = (unixepoch()*1000)
        WHERE variant_id = ${l.variantId} AND reserved >= ${l.quantity}`);
    }
  }, { behavior: "immediate" }));
}

/** Convert a reservation into a sale exactly once per (order, variant). */
export async function commitSale(db: Db, lines: StockLine[], ref: string): Promise<{ applied: boolean }> {
  let applied = false;
  await retryBusy(() => db.transaction(async (tx) => {
    for (const l of lines) {
      const fresh = await claimKey(tx, `sale:${ref}:${l.variantId}`, {
        variantId: l.variantId, type: "sale", onHandDelta: -l.quantity, reservedDelta: -l.quantity, referenceType: "order", referenceId: ref,
      });
      if (!fresh) continue;
      const r = await tx.run(sql`UPDATE inventory_levels SET on_hand = on_hand - ${l.quantity}, reserved = reserved - ${l.quantity}, updated_at = (unixepoch()*1000)
        WHERE variant_id = ${l.variantId} AND reserved >= ${l.quantity} AND (allow_backorder = 1 OR on_hand >= ${l.quantity})`);
      if (affected(r) === 0) throw new AppError("CONFLICT", "Reservation missing for sale commit", { variantId: l.variantId });
      applied = true;
    }
  }, { behavior: "immediate" }));
  return { applied };
}

export type AdjustInput = { variantId: string; delta: number; type: "receive" | "adjust" | "return" | "correction"; reason: string };

/** Admin stock change. Authorization is derived from the variant's product brand in the DB. Cannot drop on-hand below reserved. */
export async function adjustStock(db: Db, actor: Actor, input: AdjustInput): Promise<void> {
  if (!Number.isInteger(input.delta) || input.delta === 0) throw new AppError("VALIDATION", "Delta must be a non-zero integer");
  if (input.reason.trim().length < 3) throw new AppError("VALIDATION", "A reason is required");
  const [row] = await db.select({ brandId: products.brandId }).from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId)).where(eq(productVariants.id, input.variantId));
  if (!row) throw new AppError("NOT_FOUND", "Variant not found");
  assertCan(actor, "inventory.adjust", row.brandId);
  await retryBusy(() => db.transaction(async (tx) => {
    const r = await tx.run(sql`UPDATE inventory_levels SET on_hand = on_hand + ${input.delta}, updated_at = (unixepoch()*1000)
      WHERE variant_id = ${input.variantId} AND on_hand + ${input.delta} >= reserved AND on_hand + ${input.delta} >= 0`);
    if (affected(r) === 0) throw new AppError("CONFLICT", "Adjustment would make stock negative or below reserved quantity");
    await tx.insert(inventoryTransactions).values({
      variantId: input.variantId, type: input.type, onHandDelta: input.delta, reason: input.reason,
      referenceType: "manual", actorUserId: actor.userId,
    });
    await writeAudit(tx, { actorUserId: actor.userId, action: "inventory.adjust", entityType: "variant", entityId: input.variantId, brandId: row.brandId, after: input });
  }, { behavior: "immediate" }));
}

function assertQty(q: number) {
  if (!Number.isInteger(q) || q < 1 || q > 99) throw new AppError("VALIDATION", "Invalid quantity");
}
