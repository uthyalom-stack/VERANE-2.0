import { integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const id = () => text().primaryKey().$defaultFn(() => crypto.randomUUID());
export const createdAt = () =>
  integer({ mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`);
export const updatedAt = () =>
  integer({ mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdate(() => new Date());
export const ts = (/* nullable timestamp */) => integer({ mode: "timestamp_ms" });
export const money = () => integer(); // integer minor units (kobo for NGN)

export const PUBLICATION = ["draft", "scheduled", "published", "archived"] as const;
export type Publication = (typeof PUBLICATION)[number];
