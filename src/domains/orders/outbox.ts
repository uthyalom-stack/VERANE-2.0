import { and, eq, lte, or, isNull } from "drizzle-orm";
import type { Db } from "@/infrastructure/db/client";
import { emailOutbox } from "@/infrastructure/db/schema";
import type { EmailProvider } from "@/infrastructure/email/types";
import { templates } from "@/infrastructure/email/templates";
import { loadOrderBundle } from "./queries";

const MAX_ATTEMPTS = 6;
const backoffMs = (attempt: number) => Math.min(60 * 60_000, 30_000 * 2 ** attempt);

/**
 * Sends pending transactional emails. Safe to run concurrently/repeatedly: a row is claimed by flipping nextAttemptAt
 * forward with a conditional update, and the (dedupeKey) unique constraint prevents duplicate rows from webhook retries.
 */
export async function processEmailOutbox(db: Db, provider: EmailProvider, cfg: { appUrl: string; adminEmail?: string | undefined }, now = new Date(), limit = 25) {
  const due = await db.select().from(emailOutbox)
    .where(and(eq(emailOutbox.status, "pending"), or(isNull(emailOutbox.nextAttemptAt), lte(emailOutbox.nextAttemptAt, now)))).limit(limit);
  let sent = 0, failed = 0;
  for (const row of due) {
    const claim = await db.update(emailOutbox).set({ nextAttemptAt: new Date(now.getTime() + 5 * 60_000) })
      .where(and(eq(emailOutbox.id, row.id), eq(emailOutbox.status, "pending"), or(isNull(emailOutbox.nextAttemptAt), lte(emailOutbox.nextAttemptAt, now))));
    if (((claim as unknown as { rowsAffected?: number }).rowsAffected ?? 0) === 0) continue; // another worker has it
    try {
      const to = row.toEmail === "@admin" ? cfg.adminEmail : row.toEmail;
      if (!to) { await db.update(emailOutbox).set({ status: "sent", lastError: "no recipient configured", sentAt: now }).where(eq(emailOutbox.id, row.id)); continue; }
      const p = row.payloadJson as { orderId?: string; shipmentStatus?: string; trackingUrl?: string | null };
      const b = p.orderId ? await loadOrderBundle(db, p.orderId) : null;
      if (!b) throw new Error("order missing");
      const url = `${cfg.appUrl}/orders/${b.order.orderNumber}`;
      const msg = row.template === "order_confirmation" ? templates.orderConfirmation(to, { orderNumber: b.order.orderNumber, total: b.order.total, currency: b.order.currency, items: b.items.map((i) => ({ name: i.productName, qty: i.quantity, line: i.lineTotal })), url })
        : row.template === "admin_new_order" ? templates.adminNewOrder(to, { orderNumber: b.order.orderNumber, total: b.order.total, currency: b.order.currency, url: `${cfg.appUrl}/admin/orders/${b.order.id}` })
        : row.template === "shipping_update" ? templates.shippingUpdate(to, { orderNumber: b.order.orderNumber, status: p.shipmentStatus ?? "updated", trackingUrl: p.trackingUrl ?? null, url })
        : null;
      if (!msg) throw new Error(`unknown template ${row.template}`);
      await provider.send(msg);
      await db.update(emailOutbox).set({ status: "sent", sentAt: now, attempts: row.attempts + 1, lastError: null }).where(eq(emailOutbox.id, row.id));
      sent++;
    } catch (e) {
      const attempts = row.attempts + 1;
      await db.update(emailOutbox).set({ attempts, lastError: String(e).slice(0, 300), status: attempts >= MAX_ATTEMPTS ? "failed" : "pending", nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)) }).where(eq(emailOutbox.id, row.id));
      failed++;
    }
  }
  return { sent, failed };
}
