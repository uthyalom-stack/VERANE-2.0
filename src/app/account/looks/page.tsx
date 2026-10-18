import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/infrastructure/db/client";
import { requireCustomer } from "@/lib/http/session";
import { listSavedLooks } from "@/domains/account";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Saved Looks", robots: { index: false } };
export default async function SavedLooks() {
  const u = await requireCustomer("/account/looks"); const list = await listSavedLooks(getDb(), u.id);
  return (<div><h1 className="display text-6xl">Saved Looks</h1>{list.length === 0 ? <EmptyState title="No saved looks" action={<ButtonLink href="/looks">Browse Looks</ButtonLink>} /> :
    <ul className="mt-8 divide-y divide-line">{list.map(({ look }) => <li key={look.id}><Link href={`/looks/${look.slug}`} className="block py-5 text-xl hover:bg-surface">{look.title}</Link></li>)}</ul>}</div>);
}
