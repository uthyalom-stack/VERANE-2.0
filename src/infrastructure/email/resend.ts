import { AppError } from "@/lib/errors";
import type { EmailMessage, EmailProvider } from "./types";

/** Resend REST adapter (POST https://api.resend.com/emails). LIVE UNVERIFIED until a key is supplied. */
export function createResendProvider(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): EmailProvider {
  if (!apiKey) throw new AppError("CONFIG", "RESEND_API_KEY is required for the resend driver");
  return {
    name: "resend",
    async send(m: EmailMessage) {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text }), signal: AbortSignal.timeout(15_000),
      });
      const j = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
      if (!res.ok) throw new AppError("PROVIDER", "Email provider error", { status: res.status, message: j?.message });
      return { id: j?.id ?? null };
    },
  };
}
