import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/infrastructure/db/client";
import { requireCustomer } from "@/lib/http/session";
import { listOutfits } from "@/domains/outfit";
import { deleteOutfitAction } from "@/app/actions/content";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Saved outfits", robots: { index: false } };
export default async function Outfits() {
  const u = await requireCustomer("/account/outfits"); const list = await listOutfits(getDb(), u.id);
  return (<div><h1 className="display text-6xl">Saved outfits</h1>{list.length === 0 ? <EmptyState title="No saved outfits" action={<ButtonLink href="/outfit-builder">Open the Outfit Builder</ButtonLink>} /> :
    <ul className="mt-8 divide-y divide-line">{list.map((o) => <li key={o.id} className="flex items-center justify-between py-5"><Link href={`/outfit-builder?outfit=${o.id}`} className="text-xl underline-offset-4 hover:underline">{o.name}</Link>
      <form action={deleteOutfitAction.bind(null, o.id)}><button className="text-sm text-muted underline">Delete</button></form></li>)}</ul>}</div>);
}
