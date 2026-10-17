"use client";
import { ActionForm } from "@/components/ui/action-form";
import { subscribeAction } from "@/app/actions/content";

export function NewsletterSignup() {
  return (
    <section id="newsletter" aria-labelledby="nl" className="mx-auto mt-28 grid max-w-[1600px] gap-8 px-5 md:grid-cols-2 md:px-10">
      <div><h2 id="nl" className="display text-5xl md:text-7xl">The VÉRANE letter</h2><p className="mt-4 text-muted">New drops and stories from both houses. Unsubscribe any time.</p></div>
      <div className="glass rounded-[var(--r-lg)] p-6"><ActionForm action={subscribeAction} submitLabel="Subscribe" fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }, { name: "consent", label: "I agree to receive marketing emails from VÉRANE", type: "checkbox", required: false }]} /></div>
    </section>
  );
}
