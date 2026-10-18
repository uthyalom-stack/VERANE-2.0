import { getDb } from "@/infrastructure/db/client";
import { requireAdmin } from "@/lib/http/session";
export async function adminCtx() { const { user, actor } = await requireAdmin(); return { db: getDb(), user, actor }; }
export const dollars = (minor: number | null | undefined) => (minor == null ? "" : (minor / 100).toFixed(2));
