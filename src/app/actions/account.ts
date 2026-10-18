"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/infrastructure/db/client";
import { requireCustomer } from "@/lib/http/session";
import { fd, run, type ActionState } from "@/lib/http/action";
import { deleteAddress, markNotificationsRead, saveAddress, toggleSavedLook, toggleWishlist, updatePreferences, updateProfile } from "@/domains/account";

export async function toggleWishlistAction(productId: string, variantId: string | null): Promise<ActionState<{ saved: boolean }>> {
  return run(async () => { const u = await requireCustomer(); const saved = await toggleWishlist(getDb(), u.id, productId, variantId); revalidatePath("/account/wishlist"); return { ok: true, data: { saved } }; });
}
export async function toggleSavedLookAction(lookId: string): Promise<ActionState<{ saved: boolean }>> {
  return run(async () => { const u = await requireCustomer(); const saved = await toggleSavedLook(getDb(), u.id, lookId); revalidatePath("/account/looks"); return { ok: true, data: { saved } }; });
}
export async function saveAddressAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => { const u = await requireCustomer(); const raw = fd(form); await saveAddress(getDb(), u.id, { ...raw, isDefault: raw.isDefault === "on" }, raw.id || undefined); revalidatePath("/account/addresses"); return { ok: true, message: "Address saved" }; });
}
export async function deleteAddressAction(id: string): Promise<void> {
  await run(async () => { const u = await requireCustomer(); await deleteAddress(getDb(), u.id, id); revalidatePath("/account/addresses"); });
}
export async function updateProfileAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => { const u = await requireCustomer(); await updateProfile(getDb(), u.id, fd(form)); revalidatePath("/account"); return { ok: true, message: "Profile updated" }; });
}
export async function updatePreferencesAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => { const u = await requireCustomer(); const r = fd(form); await updatePreferences(getDb(), u.id, { marketingEmailOptIn: r.marketingEmailOptIn === "on", favoriteStyles: r.favoriteStyles, sizeNotes: r.sizeNotes }); return { ok: true, message: "Preferences saved" }; });
}
export async function markNotificationsReadAction(): Promise<void> { await run(async () => { const u = await requireCustomer(); await markNotificationsRead(getDb(), u.id); revalidatePath("/account"); }); }
