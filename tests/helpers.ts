import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb } from "@/infrastructure/db/client";
import { applyMigrations } from "@/infrastructure/db/migrate";
import { reconcileRbac } from "@/domains/authorization/seed";
import * as s from "@/infrastructure/db/schema";
import { loadActor } from "@/domains/authorization";
import { hashPassword } from "@/lib/crypto";

export async function makeTestDb() {
  const file = path.join(tmpdir(), `verane-test-${crypto.randomUUID()}.db`);
  const { db, client } = createDb(`file:${file}`);
  await applyMigrations(db);
  await reconcileRbac(db);
  return { db, cleanup: () => { client.close(); rmSync(file, { force: true }); } };
}

export async function seedBrandsAndActors(db: Awaited<ReturnType<typeof makeTestDb>>["db"]) {
  const [uthy] = await db.insert(s.brands).values({ code: "UTHY_LUXURY", slug: "uthy-luxury", name: "UTHY LUXURY", themeKey: "uthy", createdAt: new Date(), updatedAt: new Date() }).returning();
  const [alo] = await db.insert(s.brands).values({ code: "ALOMZIEE_FOOTIES", slug: "alomziee-footies", name: "ALOMZIEE FOOTIES", themeKey: "alomzie", createdAt: new Date(), updatedAt: new Date() }).returning();
  const roles = Object.fromEntries((await db.select().from(s.roles)).map((r) => [r.code ?? "", r.id]));
  async function mk(email: string, role: string, brandId: string | null) {
    const [u] = await db.insert(s.users).values({ email, name: email.split("@")[0]!, isActive: true, passwordHash: await hashPassword("password-123456"), kind: "admin", createdAt: new Date(), updatedAt: new Date() }).returning();
    await db.insert(s.userRoles).values({ userId: u!.id, roleId: roles[role]!, brandId });
    return loadActor(db, u!.id);
  }
  return {
    uthy: uthy!, alo: alo!,
    superAdmin: await mk("s@t.dev", "SUPER_ADMIN", null),
    uthyAdmin: await mk("u@t.dev", "UTHY_ADMIN", uthy!.id),
    aloAdmin: await mk("a@t.dev", "ALOMZIEE_ADMIN", alo!.id),
  };
}
