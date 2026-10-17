"use client";

import { useState, useTransition } from "react";
import { subscribeBackInStockAction } from "@/app/actions/parity";

type Option = { id: string; size: string | null; colorName: string | null };

export function BackInStockForm({ productId, variants }: { productId: string; variants: Option[] }) {
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);
    startTransition(async () => {
      const result = await subscribeBackInStockAction({ productId, variantId, email });
      setMessage(result.message ?? (result.ok ? "You're on the list." : "Please try again."));
      setSuccess(result.ok);
      if (result.ok) setEmail("");
    });
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3 border border-line p-4" aria-label="Back in stock notification">
      <div>
        <h2 className="text-lg">Notify me when it returns</h2>
        <p className="mt-1 text-sm text-muted">Choose your option and we'll email you when it's back in stock.</p>
      </div>
      {variants.length > 0 && (
        <label className="block text-sm">
          Size / colour
          <select value={variantId} onChange={(e) => setVariantId(e.target.value)} required className="mt-1 block w-full rounded border border-line bg-bg p-3">
            {variants.map((v) => <option key={v.id} value={v.id}>{[v.size, v.colorName].filter(Boolean).join(" / ") || "Standard option"}</option>)}
          </select>
        </label>
      )}
      <label className="block text-sm">
        Email address
        <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full rounded border border-line bg-bg p-3" placeholder="you@example.com" />
      </label>
      <button type="submit" disabled={pending || !variantId} className="w-full rounded bg-fg px-4 py-3 text-sm text-bg disabled:opacity-50">
        {pending ? "Saving…" : "Notify me"}
      </button>
      {message && <p role={success ? "status" : "alert"} className="text-sm text-muted">{message}</p>}
    </form>
  );
}
