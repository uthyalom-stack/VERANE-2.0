import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/infrastructure/db/client";
import { discounts } from "@/infrastructure/db/schema";
import { AppError } from "@/lib/errors";
import { assertCan, type Actor } from "@/domains/authorization";
import { writeAudit } from "@/domains/audit";
import { brandScopeWhere } from "./scope";

const schema = z.object({
  code: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9_-]+$/).transform((s) => s.toUpperCase()), brandId: z.string().nullable().optional(),
  kind: z.enum(["percent", "fixed"]), value: z.number().int().min(1), minSubtotal: z.number().int().min(0).nullable().optional(),
  maxRedemptions: z.number().int().min(1).nullable().optional(), startsAt: z.coerce.date().nullable().optional(), endsAt: z.coerce.date().nullable().optional(), isActive: z.boolean().default(true),
}).superRefine((d, c) => { if (d.kind === "percent" && d.value > 100) c.addIssue({ code: "custom", path: ["value"], message: "Percent must be 1–100" }); if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) c.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after start" }); });

export async function saveDiscount(db: Db, actor: Actor, raw: unknown, id?: string) {
  const d = schema.parse(raw); const brandId = d.brandId || null;
  if (id) { const [ex] = await db.select().from(discounts).where(eq(discounts.id, id)); if (!ex) throw new AppError("NOT_FOUND", "Discount not found"); assertCan(actor, "discounts.write", ex.brandId); }
  assertCan(actor, "discounts.write", brandId); // house-wide (null) codes: super admin only
  const row = { code: d.code, brandId, kind: d.kind, value: d.value, minSubtotal: d.minSubtotal ?? null, maxRedemptions: d.maxRedemptions ?? null, startsAt: d.startsAt ?? null, endsAt: d.endsAt ?? null, isActive: d.isActive };
  try { if (id) await db.update(discounts).set(row).where(eq(discounts.id, id)); else await db.insert(discounts).values(row); }
  catch (e) { if (String(e).includes("UNIQUE")) throw new AppError("CONFLICT", "That code already exists"); throw e; }
  await writeAudit(db, { actorUserId: actor.userId, action: "discount.save", entityType: "discount", entityId: id ?? d.code, brandId, after: row });
}
export const listDiscounts = (db: Db, actor: Actor) => db.select().from(discounts).where(brandScopeWhere(actor, "discounts.write", discounts.brandId)).orderBy(desc(discounts.createdAt));
