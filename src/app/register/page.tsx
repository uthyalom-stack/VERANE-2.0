import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/ui/auth-shell";
import { ActionForm } from "@/components/ui/action-form";
import { registerAction } from "@/app/actions/auth";
import { safeNext } from "@/lib/http/origin";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next, "/account");
  return (
    <AuthShell title="Join the house" intro="Save pieces, build outfits and follow your orders.">
      <ActionForm action={registerAction} submitLabel="Create account" hidden={{ next }}
        fields={[{ name: "firstName", label: "First name", autoComplete: "given-name" }, { name: "lastName", label: "Last name", autoComplete: "family-name" }, { name: "email", label: "Email", type: "email", autoComplete: "email" }, { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 10 characters." }]}
        footer={<p className="text-sm text-muted">Already have an account? <Link href="/login" className="underline">Sign in</Link></p>} />
    </AuthShell>
  );
}
