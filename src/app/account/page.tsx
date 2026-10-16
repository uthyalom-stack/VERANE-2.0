import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { requireCustomer } from "@/lib/http/session";
import { customerProfiles } from "@/infrastructure/db/schema";
import { getPreferences, listNotifications } from "@/domains/account";
import { ActionForm } from "@/components/ui/action-form";
import { updatePreferencesAction, updateProfileAction, markNotificationsReadAction } from "@/app/actions/account";
import Link from "next/link";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default async function AccountPage() {
  const u = await requireCustomer(); const db = getDb();
  const [p] = await db.select().from(customerProfiles).where(eq(customerProfiles.userId, u.id));
  const [prefs, notes] = await Promise.all([getPreferences(db, u.id), listNotifications(db, u.id)]);
  return (
    <div className="grid gap-14">
      <h1 className="display text-6xl">Hello{p ? `, ${p.firstName}` : ""}</h1>
      {!u.emailVerifiedAt && <p role="status" className="rounded-[var(--r-md)] border border-line p-4 text-sm">Your email isn&apos;t verified yet. Check your inbox for the confirmation link.</p>}
      <section><h2 className="display mb-6 text-3xl">Profile</h2><div className="max-w-md"><ActionForm action={updateProfileAction} submitLabel="Save profile" fields={[{ name: "firstName", label: "First name", defaultValue: p?.firstName }, { name: "lastName", label: "Last name", defaultValue: p?.lastName }, { name: "phone", label: "Phone", type: "tel", required: false, defaultValue: p?.phone ?? "" }]} /></div></section>
      <section><h2 className="display mb-6 text-3xl">Preferences</h2><div className="max-w-md"><ActionForm action={updatePreferencesAction} submitLabel="Save preferences" fields={[{ name: "marketingEmailOptIn", label: "Send me VÉRANE news and offers (order emails are always sent)", type: "checkbox", required: false, defaultValue: prefs.marketingEmailOptIn ? "on" : "" }, { name: "favoriteStyles", label: "Favourite styles", required: false, defaultValue: (prefs.favoriteStyles ?? []).join(", "), hint: "Comma separated, e.g. Tailored, Street" }, { name: "sizeNotes", label: "Size notes", required: false, defaultValue: prefs.sizeNotes ?? "" }]} /></div></section>
      <section><div className="mb-6 flex items-center justify-between"><h2 className="display text-3xl">Notifications</h2>{notes.some((n) => !n.readAt) && <form action={markNotificationsReadAction}><button className="text-sm underline">Mark all read</button></form>}</div>
        {notes.length === 0 ? <p className="text-muted">Nothing new. Order updates will appear here.</p> : <ul className="divide-y divide-line">{notes.map((n) => <li key={n.id} className="py-3 text-sm"><p className={n.readAt ? "text-muted" : ""}>{n.href ? <Link href={n.href} className="underline">{n.title}</Link> : n.title}</p>{n.body && <p className="text-muted">{n.body}</p>}</li>)}</ul>}</section>
    </div>
  );
}
