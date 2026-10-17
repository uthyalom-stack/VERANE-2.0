import { formatMoney } from "@/lib/money";
import type { EmailMessage } from "./types";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** One VÉRANE email shell: ink background header, bone body, single call to action. Inline CSS only (mail clients). */
function shell(title: string, intro: string, rows: string, cta?: { label: string; url: string }, foot = "You are receiving this because of activity on your VÉRANE account."): string {
  return `<!doctype html><html><body style="margin:0;background:#f2f0ec;font-family:Helvetica,Arial,sans-serif;color:#0c0c0e">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" style="max-width:560px;background:#fff">
<tr><td style="background:#0c0c0e;color:#f2f0ec;padding:28px;font-family:Georgia,serif;font-size:26px;letter-spacing:6px">VÉRANE</td></tr>
<tr><td style="padding:32px"><h1 style="font-family:Georgia,serif;font-weight:500;font-size:28px;margin:0 0 16px">${esc(title)}</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 20px">${esc(intro)}</p>${rows}
${cta ? `<p style="margin:28px 0 0"><a href="${esc(cta.url)}" style="background:#0c0c0e;color:#f2f0ec;padding:14px 26px;text-decoration:none;font-size:14px">${esc(cta.label)}</a></p>` : ""}
</td></tr><tr><td style="padding:20px 32px;font-size:12px;color:#666">${esc(foot)}</td></tr></table></td></tr></table></body></html>`;
}
const strip = (lines: string[]) => lines.join("\n");

export const templates = {
  verifyEmail: (to: string, url: string): EmailMessage => ({ to, subject: "Verify your email — VÉRANE", html: shell("Welcome to VÉRANE", "Confirm your email address to finish creating your account. The link works for 24 hours.", "", { label: "Verify email", url }), text: strip(["Welcome to VÉRANE.", `Verify your email: ${url}`, "The link works for 24 hours."]) }),
  passwordReset: (to: string, url: string): EmailMessage => ({ to, subject: "Reset your VÉRANE password", html: shell("Reset your password", "Use the link below to choose a new password. It works for one hour and only once. If you didn't ask for this, ignore this email.", "", { label: "Choose a new password", url }), text: strip(["Reset your VÉRANE password:", url, "Valid for one hour. Ignore if you didn't request it."]) }),
  orderConfirmation: (to: string, d: { orderNumber: string; total: number; currency: string; items: Array<{ name: string; qty: number; line: number }>; url: string }): EmailMessage => {
    const rows = `<table width="100%" style="font-size:14px;border-top:1px solid #ddd">${d.items.map((i) => `<tr><td style="padding:8px 0">${esc(i.name)} × ${i.qty}</td><td align="right">${esc(formatMoney(i.line, d.currency))}</td></tr>`).join("")}<tr><td style="padding-top:12px"><b>Total</b></td><td align="right" style="padding-top:12px"><b>${esc(formatMoney(d.total, d.currency))}</b></td></tr></table>`;
    return { to, subject: `Order ${d.orderNumber} confirmed — payment received`, html: shell("Thank you. Your order is confirmed.", `Order ${d.orderNumber}. We've received your payment and are preparing your pieces.`, rows, { label: "View order", url: d.url }), text: strip([`Order ${d.orderNumber} confirmed. Payment received.`, ...d.items.map((i) => `${i.name} x${i.qty}  ${formatMoney(i.line, d.currency)}`), `Total ${formatMoney(d.total, d.currency)}`, d.url]) };
  },
  shippingUpdate: (to: string, d: { orderNumber: string; status: string; trackingUrl: string | null; url: string }): EmailMessage => ({ to, subject: `Order ${d.orderNumber}: ${d.status}`, html: shell(`Your order is ${d.status.toLowerCase()}`, `Order ${d.orderNumber} has a new delivery update.`, "", { label: d.trackingUrl ? "Track delivery" : "View order", url: d.trackingUrl ?? d.url }), text: strip([`Order ${d.orderNumber}: ${d.status}`, d.trackingUrl ?? d.url]) }),
  backInStock: (to: string, d: { productName: string; url: string }): EmailMessage => ({
    to, subject: `Back in stock: ${d.productName} — VÉRANE`,
    html: shell("It's back.", `${d.productName} is available again. Stock can change quickly, so visit the piece if you'd still like it.`, "", { label: "Shop the piece", url: d.url }, "You are receiving this because you asked to be notified when this item returned."),
    text: [`${d.productName} is back in stock.`, d.url, "You are receiving this because you requested a restock notification."].join("\n"),
  }),
  adminNewOrder: (to: string, d: { orderNumber: string; total: number; currency: string; url: string }): EmailMessage => ({ to, subject: `New paid order ${d.orderNumber}`, html: shell("New paid order", `${d.orderNumber} — ${formatMoney(d.total, d.currency)}`, "", { label: "Open in admin", url: d.url }, "Administrator notification."), text: `New paid order ${d.orderNumber} (${formatMoney(d.total, d.currency)})\n${d.url}` }),
};
