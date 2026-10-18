import type { Metadata } from "next";
import { AuthShell } from "@/components/ui/auth-shell";
import { ActionForm } from "@/components/ui/action-form";
import { forgotPasswordAction } from "@/app/actions/auth";
export const metadata: Metadata = { title: "Reset password", robots: { index: false } };
export default function Page() {
  return <AuthShell title="Reset password" intro="Enter your email and we'll send a one-time link."><ActionForm action={forgotPasswordAction} submitLabel="Send reset link" fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]} /></AuthShell>;
}
