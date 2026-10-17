import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/lib/env";
import { getCartView } from "@/domains/cart";
import { peekCartId } from "@/lib/http/cart-cookie";
import { getCurrentUser } from "@/lib/http/session";
import { addresses, customerProfiles } from "@/infrastructure/db/schema";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const id = await peekCartId(); const e = getEnv();
  if (!id) redirect("/cart");
  const view = await getCartView(getDb(), id, { taxBps: e.TAX_BPS, taxInclusive: e.TAX_INCLUSIVE === "true" });
  if (view.lines.length === 0) redirect("/cart");
  if (!view.canCheckout) redirect("/cart");
  const user = await getCurrentUser();
  const [profile] = user ? await getDb().select().from(customerProfiles).where(eq(customerProfiles.userId, user.id)) : [];
  const saved = user ? await getDb().select().from(addresses).where(eq(addresses.userId, user.id)) : [];
  const d = saved.find((a) => a.isDefault) ?? saved[0];
  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-28 md:px-10">
      <div className="house-index-intro flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="house-kicker">Almost yours</p><h1 className="display mt-4 text-6xl md:text-8xl">Checkout.</h1></div><p className="max-w-xs text-sm leading-relaxed text-muted">Review your pieces, confirm delivery, then complete payment securely.</p></div>
      <CheckoutForm view={view} signedIn={!!user} savedAddresses={saved.map((a) => ({ id: a.id, label: a.label ?? a.line1, recipientName: a.recipientName, phone: a.phone, line1: a.line1, line2: a.line2 ?? "", city: a.city, state: a.state, postalCode: a.postalCode ?? "" }))}
        defaults={{ email: user?.email ?? "", recipientName: d?.recipientName ?? (profile ? `${profile.firstName} ${profile.lastName}` : ""), phone: d?.phone ?? profile?.phone ?? "", line1: d?.line1 ?? "", line2: d?.line2 ?? "", city: d?.city ?? "", state: d?.state ?? "", postalCode: d?.postalCode ?? "" }} />
    </div>
  );
}
