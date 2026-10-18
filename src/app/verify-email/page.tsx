import type { Metadata } from "next";
import { AuthShell } from "@/components/ui/auth-shell";
import { ActionForm } from "@/components/ui/action-form";
import { verifyEmailAction } from "@/app/actions/auth";
export const metadata: Metadata = { title: "Verify email", robots: { index: false } };
/** Verification needs a deliberate click (POST) so mail scanners that prefetch links can't consume the token. */
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  return <AuthShell title="Verify email" intro="One click to confirm this address."><ActionForm action={verifyEmailAction} submitLabel="Confirm my email" hidden={{ token }} fields={[]} /></AuthShell>;
}
