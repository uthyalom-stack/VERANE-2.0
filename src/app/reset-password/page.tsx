import type { Metadata } from "next";
import { AuthShell } from "@/components/ui/auth-shell";
import { ActionForm } from "@/components/ui/action-form";
import { resetPasswordAction } from "@/app/actions/auth";
export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  return <AuthShell title="New password" intro="This link works once."><ActionForm action={resetPasswordAction} submitLabel="Save password" hidden={{ token }} fields={[{ name: "password", label: "New password", type: "password", autoComplete: "new-password", hint: "At least 10 characters." }, { name: "confirm", label: "Confirm password", type: "password", autoComplete: "new-password" }]} /></AuthShell>;
}
