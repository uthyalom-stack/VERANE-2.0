import Link from "next/link";
import type { ReactNode } from "react";

export function PageHead({ title, action, sub }: { title: string; action?: ReactNode; sub?: string }) {
  return <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><h1 className="display text-4xl md:text-5xl">{title}</h1>{sub && <p className="mt-2 text-sm text-muted">{sub}</p>}</div>{action}</div>;
}
export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return <section className="mb-8 rounded-[var(--r-md)] border border-line p-5">{title && <h2 className="display mb-4 text-2xl">{title}</h2>}{children}</section>;
}
export function Table({ head, rows, empty = "Nothing here yet." }: { head: string[]; rows: ReactNode[][]; empty?: string }) {
  if (rows.length === 0) return <p role="status" className="rounded-[var(--r-md)] border border-dashed border-line p-8 text-center text-sm text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-[var(--r-md)] border border-line"><table className="w-full text-left text-sm"><thead className="border-b border-line text-muted"><tr>{head.map((h) => <th key={h} scope="col" className="px-4 py-3 font-normal">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-line">{rows.map((r, i) => <tr key={i} className="hover:bg-surface">{r.map((c, j) => <td key={j} className="px-4 py-3 align-top">{c}</td>)}</tr>)}</tbody></table></div>
  );
}
export function Badge({ children, tone = "" }: { children: ReactNode; tone?: "ok" | "warn" | "bad" | "" }) {
  const t = { ok: "border-emerald-500/40 text-emerald-300", warn: "border-amber-500/40 text-amber-300", bad: "border-red-500/40 text-red-300", "": "border-line text-muted" }[tone];
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs ${t}`}>{children}</span>;
}
export const statusTone = (s: string): "ok" | "warn" | "bad" | "" => (["published", "paid", "delivered", "sent", "configured"].includes(s) ? "ok" : ["draft", "pending_payment", "processing", "scheduled"].includes(s) ? "warn" : ["archived", "cancelled", "failed", "payment_failed", "expired", "refunded"].includes(s) ? "bad" : "");
export const A = ({ href, children }: { href: string; children: ReactNode }) => <Link href={href} className="underline underline-offset-4 hover:text-accent">{children}</Link>;
export const when = (d: Date | null | undefined) => (d ? d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—");
export const toLocalInput = (d: Date | null | undefined) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
