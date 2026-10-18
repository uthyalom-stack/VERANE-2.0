import type { Metadata } from "next";
import { AuthShell } from "@/components/ui/auth-shell";
import { ActionForm } from "@/components/ui/action-form";
import { adminLoginAction } from "@/app/actions/auth";
export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };
export default function Page() {
  return <AuthShell title="Admin" intro="Authorised staff only."><ActionForm action={adminLoginAction} submitLabel="Sign in" fields={[{ name: "email", label: "Work email", type: "email", autoComplete: "username" }, { name: "password", label: "Password", type: "password", autoComplete: "current-password" }]} /></AuthShell>;
}
