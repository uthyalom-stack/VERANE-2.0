import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/ui/auth-shell";
import { ActionForm } from "@/components/ui/action-form";
import { loginAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/http/session";
import { safeNext } from "@/lib/http/origin";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/account");
  if ((await getCurrentUser())?.kind === "customer") redirect(next);
  return (
    <AuthShell title="Sign in" intro={sp.reset ? "Your password has been changed. Sign in with the new one." : "Your orders, wishlist, saved outfits and addresses."}>
      <ActionForm action={loginAction} submitLabel="Sign in" hidden={{ next }} fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }, { name: "password", label: "Password", type: "password", autoComplete: "current-password" }]}
        footer={<div className="flex justify-between text-sm text-muted"><Link href="/forgot-password" className="underline">Forgot password?</Link><Link href={`/register?next=${encodeURIComponent(next)}`} className="underline">Create account</Link></div>} />
    </AuthShell>
  );
}
