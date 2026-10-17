import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/lib/env";
import { getOrderForViewer } from "@/domains/orders/queries";
import { viewerFromCookies } from "@/lib/http/order-access";

export const dynamic = "force-dynamic";

function pdfSafe(value: unknown): string {
  return String(value ?? "")
    .replace(/₦/g, "NGN ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .slice(0, 150);
}

function money(minor: number, currency: string) {
  return `${currency} ${(minor / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Minimal dependency-free PDF writer. Text is sanitized to PDF's standard Helvetica encoding. */
function makePdf(lines: string[]): Uint8Array {
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += 48) pages.push(lines.slice(i, i + 48));
  if (!pages.length) pages.push(["VÉRANE receipt"]);

  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  pages.forEach((page, i) => {
    const pageId = 4 + i * 2;
    const streamId = pageId + 1;
    const text = ["BT", "/F1 10 Tf", "50 790 Td", "14 TL", ...page.flatMap((line, j) => [
      `(${pdfSafe(line)}) Tj`,
      ...(j < page.length - 1 ? ["T*"] : []),
    ]), "ET"].join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);
    objects.push(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
  });

  let pdf = "%PDF-1.4\n%VERANE\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export async function GET(_: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const env = getEnv();
  const bundle = await getOrderForViewer(getDb(), orderNumber, await viewerFromCookies(orderNumber), env.TOKEN_PEPPER);
  if (!bundle) return new Response("Not found", { status: 404 });

  const { order, items, fulfillments } = bundle;
  const address = order.shippingAddressJson ?? {};
  const lines = [
    "VERANE",
    "ORDER RECEIPT",
    "",
    `Order: ${order.orderNumber}`,
    `Date: ${order.createdAt.toLocaleString("en-NG")}`,
    `Status: ${order.status.replace(/_/g, " ")}`,
    `Payment: ${order.paymentStatus}`,
    `Customer: ${order.email}`,
    "",
    "ITEMS",
    ...items.flatMap((item) => [
      item.productName,
      `  SKU ${item.sku} | ${[item.colorName, item.size ? `Size ${item.size}` : null].filter(Boolean).join(" | ") || "Standard"} | Qty ${item.quantity}`,
      `  ${money(item.lineTotal, order.currency)}`,
      ...(item.isPreOrder ? [`  Pre-order: ${item.fulfillmentTimeSnapshot ?? "Lead time to be confirmed"}`] : []),
      ...(item.customMeasurements ? [`  Custom measurements (cm): ${Object.entries(item.customMeasurements).map(([k, v]) => `${k} ${v}`).join(", ")}`] : []),
      "",
    ]),
    "TOTALS",
    `Subtotal: ${money(order.subtotal, order.currency)}`,
    `Discount: -${money(order.discountTotal, order.currency)}`,
    `Delivery: ${money(order.shippingTotal, order.currency)}`,
    `Tax: ${money(order.taxTotal, order.currency)}`,
    `TOTAL: ${money(order.total, order.currency)}`,
    "",
    "DELIVERY ADDRESS",
    String(address.recipientName ?? ""),
    String(address.line1 ?? ""),
    String(address.line2 ?? ""),
    [address.city, address.state, address.postalCode, address.country].filter(Boolean).join(", "),
    "",
    "FULFILMENT",
    ...fulfillments.flatMap((f) => { let p: Record<string, string> = {}; try { p = f.pickupLocationSnapshot ? JSON.parse(f.pickupLocationSnapshot) as Record<string, string> : {}; } catch { p = {}; } return [`${f.method.toUpperCase()}: ${f.status.replace(/_/g, " ")}`, ...(f.method === "pickup" ? [String(p.name ?? "Pickup location"), [p.addressLine1, p.addressLine2, p.city, p.state, p.postalCode].filter(Boolean).join(", "), String(p.instructions ?? "")] : [`${f.carrier ?? "Delivery"} ${f.trackingNumber ?? ""} ${f.trackingUrl ?? ""}`]), ""]; }),
    "Thank you for shopping with VERANE.",
    "Keep this receipt for your records.",
  ];

  return new Response(makePdf(lines), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="verane-${order.orderNumber.toLowerCase()}-receipt.pdf"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
