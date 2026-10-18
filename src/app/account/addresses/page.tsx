import type { Metadata } from "next";
import { getDb } from "@/infrastructure/db/client";
import { requireCustomer } from "@/lib/http/session";
import { listAddresses } from "@/domains/account";
import { ActionForm } from "@/components/ui/action-form";
import { deleteAddressAction, saveAddressAction } from "@/app/actions/account";

export const metadata: Metadata = { title: "Addresses", robots: { index: false } };
export default async function Addresses() {
  const u = await requireCustomer("/account/addresses"); const list = await listAddresses(getDb(), u.id);
  return (<div><h1 className="display text-6xl">Addresses</h1>
    <ul className="mt-8 grid gap-4 md:grid-cols-2">{list.map((a) => <li key={a.id} className="rounded-[var(--r-md)] border border-line p-5 text-sm"><p className="font-medium">{a.label || a.recipientName}{a.isDefault && <span className="ml-2 text-accent">Default</span>}</p><p className="mt-2 text-muted">{a.recipientName}<br />{a.line1}{a.line2 && <>, {a.line2}</>}<br />{a.city}, {a.state}<br />{a.phone}</p>
      <form action={deleteAddressAction.bind(null, a.id)} className="mt-3"><button className="text-sm underline">Remove</button></form></li>)}</ul>
    <h2 className="display mb-6 mt-14 text-3xl">Add an address</h2><div className="max-w-md"><ActionForm action={saveAddressAction} submitLabel="Save address" fields={[{ name: "label", label: "Label (Home, Office)", required: false }, { name: "recipientName", label: "Full name", autoComplete: "name" }, { name: "phone", label: "Phone", type: "tel", autoComplete: "tel" }, { name: "line1", label: "Address", autoComplete: "address-line1" }, { name: "line2", label: "Apartment, suite", required: false }, { name: "city", label: "City", autoComplete: "address-level2" }, { name: "state", label: "State", autoComplete: "address-level1" }, { name: "postalCode", label: "Postal code", required: false }, { name: "isDefault", label: "Make this my default address", type: "checkbox", required: false }]} /></div></div>);
}
