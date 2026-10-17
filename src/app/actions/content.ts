"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/lib/env";
import { sha256Hex } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { requireCustomer } from "@/lib/http/session";
import { clientIp } from "@/lib/http/origin";
import { ensureCartId } from "@/lib/http/cart-cookie";
import { fd, run, type ActionState } from "@/lib/http/action";
import { addToCart } from "@/domains/cart";
import { rateLimit } from "@/domains/identity";
import { deleteOutfit, resolveOutfit, saveOutfit, setShared } from "@/domains/outfit";
import { subscribe, unsubscribe } from "@/domains/newsletter";
import { getSiteConfig } from "@/domains/site-content";

/** Add several variants at once (Shop the Look / whole outfit). Each is validated individually; partial results are reported. */
export async function addManyToBagAction(variantIds: string[]): Promise<ActionState<{ added: number; failed: string[] }>> {
  return run(async () => {
    const ids = z.array(z.string().min(1).max(64)).min(1).max(12).parse(variantIds);
    const cartId = await ensureCartId(); let added = 0; const failed: string[] = [];
    for (const id of ids) { try { await addToCart(getDb(), cartId, id, 1); added++; } catch (e) { failed.push(e instanceof AppError ? e.message : "Unavailable"); } }
    return { ok: added > 0, message: failed.length ? `${added} added. ${failed[0]}` : `${added} item${added === 1 ? "" : "s"} added to your bag`, data: { added, failed } };
  });
}

export async function priceOutfitAction(items: unknown) {
  return run(async () => ({ ok: true, data: await resolveOutfit(getDb(), items) }));
}
export async function saveOutfitAction(input: unknown, id?: string): Promise<ActionState<{ id: string }>> {
  return run(async () => { const u = await requireCustomer("/outfit-builder"); const oid = await saveOutfit(getDb(), u.id, input, id); revalidatePath("/account/outfits"); return { ok: true, message: "Outfit saved", data: { id: oid } }; });
}
export async function shareOutfitAction(id: string, shared: boolean): Promise<ActionState<{ url: string | null }>> {
  return run(async () => { const u = await requireCustomer("/account/outfits"); const t = await setShared(getDb(), u.id, id, shared); return { ok: true, data: { url: t ? `${getEnv().APP_URL}/outfit-builder/shared/${t}` : null } }; });
}
export async function deleteOutfitAction(id: string): Promise<void> { await run(async () => { const u = await requireCustomer("/account/outfits"); await deleteOutfit(getDb(), u.id, id); revalidatePath("/account/outfits"); }); }

export async function subscribeAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const e = getEnv(); const r = fd(form);
    if (!(await rateLimit(getDb(), `news:${await sha256Hex(await clientIp(), e.TOKEN_PEPPER)}`, 5, 60 * 60_000))) throw new AppError("RATE_LIMITED", "Too many attempts. Try again later.");
    await subscribe(getDb(), { email: r.email ?? "", consent: r.consent === "on" }, e.TOKEN_PEPPER);
    const config = await getSiteConfig(getDb());
    return { ok: true, message: `You're on the list. Welcome to ${config.settings.siteName}.` };
  });
}
export async function unsubscribeAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => { const r = fd(form); await unsubscribe(getDb(), r.email ?? "", r.token ?? "", getEnv().TOKEN_PEPPER); return { ok: true, message: "You've been unsubscribed from marketing emails." }; });
}
