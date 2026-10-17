"use client";
import { useState, useTransition } from "react";
import { Totals } from "@/components/commerce/bag-lines";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { Media } from "@/components/ui/media";
import { placeOrderAction, quoteShippingAction, type QuoteOption } from "@/app/actions/cart";
import type { CartView } from "@/domains/cart";

type Addr = { recipientName: string; phone: string; line1: string; line2: string; city: string; state: string; postalCode: string };
const NG_STATES = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];

export function CheckoutForm({ view, defaults, savedAddresses, signedIn }: { view: CartView; defaults: Addr & { email: string }; savedAddresses: Array<Addr & { id: string; label: string }>; signedIn: boolean }) {
  const [f, setF] = useState(defaults);
  const [options, setOptions] = useState<QuoteOption[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setOptions(null); setSel(null); };
  const chosen = options?.find((o) => o.id === sel);
  const input = (k: keyof typeof f, label: string, o: { type?: string; ac?: string; req?: boolean } = {}) => (
    <div className="grid gap-1.5"><label htmlFor={k} className="text-sm">{label}</label>
      <input id={k} name={k} type={o.type ?? "text"} autoComplete={o.ac} required={o.req ?? true} value={f[k]} onChange={set(k)} className="min-h-12 rounded-[var(--r-sm)] border border-line bg-surface px-4" /></div>);
  const complete = !!(f.email && f.recipientName && f.phone && f.line1 && f.city && f.state);

  const quote = () => start(async () => {
    setErr(null); const r = await quoteShippingAction(f);
    if (!r.ok) { setErr(r.message ?? "Could not get delivery options"); setOptions(null); return; }
    setOptions(r.data!.options); setSel(r.data!.options[0]?.id ?? null);
  });
  const pay = () => start(async () => { setErr(null); const r = await placeOrderAction({ ...f, shippingOptionId: sel ?? "" }); if (r && !r.ok) setErr(r.message ?? "Payment could not be started"); });

  return (
    <div className="house-checkout-layout mt-10 grid gap-10 md:grid-cols-[1.35fr_1fr] md:gap-14">
      <div className="grid gap-10">
        <section aria-labelledby="s-contact" className="house-checkout-section"><p className="house-kicker mb-3">01 / Your details</p><h2 id="s-contact" className="display text-3xl">Contact</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">{input("email", "Email", { type: "email", ac: "email" })}{input("phone", "Phone", { type: "tel", ac: "tel" })}</div>
          {!signedIn && <p className="mt-3 text-sm text-muted"><a className="underline" href="/login?next=/checkout">Sign in</a> to use saved addresses. Guest checkout is fine too.</p>}</section>
        <section aria-labelledby="s-addr" className="house-checkout-section"><p className="house-kicker mb-3">02 / Where it goes</p><h2 id="s-addr" className="display text-3xl">Delivery address</h2>
          {savedAddresses.length > 0 && <div className="mt-4"><label htmlFor="saved" className="text-sm">Saved addresses</label>
            <select id="saved" className="mt-1.5 min-h-12 w-full rounded-[var(--r-sm)] border border-line bg-surface px-3" defaultValue="" onChange={(e) => { const a = savedAddresses.find((x) => x.id === e.target.value); if (a) { setF({ ...f, ...a }); setOptions(null); setSel(null); } }}>
              <option value="">Choose a saved address</option>{savedAddresses.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div>}
          <div className="mt-4 grid gap-4 md:grid-cols-2">{input("recipientName", "Full name", { ac: "name" })}<div />{input("line1", "Address", { ac: "address-line1" })}{input("line2", "Apartment, suite (optional)", { ac: "address-line2", req: false })}{input("city", "City", { ac: "address-level2" })}
            <div className="grid gap-1.5"><label htmlFor="state" className="text-sm">State</label><select id="state" value={f.state} onChange={set("state")} required className="min-h-12 rounded-[var(--r-sm)] border border-line bg-surface px-3"><option value="">Select state</option>{NG_STATES.map((s) => <option key={s}>{s}</option>)}</select></div>
            {input("postalCode", "Postal code (optional)", { ac: "postal-code", req: false })}</div>
          <p className="mt-3 text-sm text-muted">We currently deliver within Nigeria.</p></section>
        <section aria-labelledby="s-del" className="house-checkout-section"><p className="house-kicker mb-3">03 / Choose your service</p><h2 id="s-del" className="display text-3xl">Delivery or pickup</h2>
          {!options ? <Button className="mt-4" variant="outline" onClick={quote} disabled={!complete || pending}>{pending ? "Finding options…" : "Show delivery options"}</Button> : (
            <fieldset className="mt-4 grid gap-3"><legend className="sr-only">Delivery options</legend>
              {options.map((o) => <label key={o.id} className="flex cursor-pointer items-center justify-between gap-4 rounded-[var(--r-md)] border border-line p-4 has-[:checked]:border-accent">
                <span className="flex items-center gap-3"><input type="radio" name="ship" checked={sel === o.id} onChange={() => setSel(o.id)} /><span>{o.method === "pickup" ? o.name : `${o.carrier} — ${o.name}`}{o.eta && <span className="block text-xs text-muted">{o.method === "pickup" ? `Pickup address: ${o.eta}` : o.eta}</span>}</span></span><span>{formatMoney(o.amountMinor, view.currency)}</span></label>)}</fieldset>)}</section>
      </div>
      <aside className="house-checkout-summary glass h-fit rounded-[var(--r-lg)] p-6 md:sticky md:top-24"><p className="house-kicker mb-3">04 / Final review</p><h2 className="display text-3xl">Your order</h2>
        <ul className="mt-4 divide-y divide-line text-sm">{view.lines.map((l) => <li key={l.variantId} className="flex items-center justify-between gap-3 py-3"><span className="flex min-w-0 items-center gap-3"><span className="house-checkout-item__image relative aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-[var(--r-sm)] bg-surface">{l.imageKey ? <Media storageKey={l.imageKey} alt="" /> : null}</span><span className="min-w-0">{l.name}<span className="mt-1 block text-xs text-muted">{[l.colorName, l.size && `Size ${l.size}`].filter(Boolean).join(" · ")} × {l.quantity}</span></span></span><span className="shrink-0">{formatMoney(l.lineTotal, view.currency)}</span></li>)}</ul>
        <div className="mt-4">{chosen ? <Totals view={{ ...view, pricing: { ...view.pricing, shippingTotal: chosen.amountMinor, total: chosen.total } }} /> : <Totals view={view} />}</div>
        <p role="alert" className="mt-4 min-h-5 text-sm text-red-400">{err}</p>
        <Button className="mt-2 w-full" onClick={pay} disabled={!chosen || pending}>{pending ? "Starting payment…" : chosen ? `Pay ${formatMoney(chosen.total, view.currency)}` : "Choose delivery to continue"}</Button>
        <p className="mt-3 text-xs text-muted">You&apos;ll complete payment securely with the payment provider. Totals and pickup eligibility are confirmed by our server before you pay.</p></aside>
    </div>
  );
}
