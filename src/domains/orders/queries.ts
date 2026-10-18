import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/infrastructure/db/client";
import { orderItems, orderStatusHistory, orders, shippingRecords } from "@/infrastructure/db/schema";
import { safeEqual, sha256Hex } from "@/lib/crypto";
import { assertCan, scopedBrandIds, type Actor } from "@/domains/authorization";
import { AppError } from "@/lib/errors";

export async function loadOrderBundle(db: Db, orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;
  const [items, history, shipments] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderId)).orderBy(desc(orderStatusHistory.createdAt)),
    db.select().from(shippingRecords).where(eq(shippingRecords.orderId, orderId)),
  ]);
  return { order, items, history, shipments };
}

export async function listOrdersForUser(db: Db, userId: string, limit = 50) {
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(Math.min(limit, 100));
}

/** Customer access: owner session OR a guest access token minted at checkout. Returns null (=> 404) otherwise; never reveals existence. */
export async function getOrderForViewer(db: Db, orderNumber: string, viewer: { userId?: string | null; token?: string | null }, pepper: string) {
  const [o] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
  if (!o) return null;
  const owner = !!viewer.userId && o.userId === viewer.userId;
  const tokenOk = !!viewer.token && !!o.publicTokenHash && safeEqual(await sha256Hex(viewer.token, pepper), o.publicTokenHash);
  return owner || tokenOk ? loadOrderBundle(db, o.id) : null;
}

/** Order number + email lookup (guest). Caller must rate-limit. Uniform null on any mismatch. */
export async function lookupOrderByEmail(db: Db, orderNumber: string, email: string) {
  const [o] = await db.select().from(orders).where(and(eq(orders.orderNumber, orderNumber.trim().toUpperCase()), eq(orders.email, email.trim().toLowerCase())));
  return o ? loadOrderBundle(db, o.id) : null;
}

/** Admin: orders visible to the actor = orders containing at least one item of an in-scope brand. */
export async function listOrdersForAdmin(db: Db, actor: Actor, limit = 100) {
  const scope = scopedBrandIds(actor, "orders.read");
  if (scope !== "all" && scope.length === 0) return [];
  if (scope === "all") return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
  const ids = (await db.selectDistinct({ id: orderItems.orderId }).from(orderItems).where(inArray(orderItems.brandId, scope))).map((r) => r.id);
  return ids.length ? db.select().from(orders).where(inArray(orders.id, ids)).orderBy(desc(orders.createdAt)).limit(limit) : [];
}

/**
 * Admin detail. A brand admin may open an order only if it has items of their brand, and sees ONLY their brand's lines
 * (customer PII is shown because they must fulfil it). Mixed-brand orders never leak the other brand's lines.
 */
export async function getOrderForAdmin(db: Db, actor: Actor, orderId: string) {
  const b = await loadOrderBundle(db, orderId);
  if (!b) throw new AppError("NOT_FOUND", "Order not found");
  const brandIds = [...new Set(b.items.map((i) => i.brandId))];
  const allowed = brandIds.filter((id) => actorCan(actor, "orders.read", id));
  if (allowed.length === 0) throw new AppError("FORBIDDEN", "You do not have access to this resource");
  return { ...b, items: b.items.filter((i) => allowed.includes(i.brandId)), partial: allowed.length < brandIds.length };
}
function actorCan(actor: Actor, perm: "orders.read", brandId: string) { try { assertCan(actor, perm, brandId); return true; } catch { return false; } }
