import type { Metadata } from "next";
import { AuthShell } from "@/components/ui/auth-shell";
import { ActionForm } from "@/components/ui/action-form";
import { unsubscribeAction } from "@/app/actions/content";
export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string; t?: string }> }) {
  const { e = "", t = "" } = await searchParams;
  return <AuthShell title="Unsubscribe" intro="Order and account emails will still be sent."><ActionForm action={unsubscribeAction} submitLabel="Unsubscribe me" hidden={{ email: e, token: t }} fields={[]} /></AuthShell>;
}
