import { desc, eq, inArray } from "drizzle-orm";
import { adminCtx } from "@/lib/admin";
import { inventoryLevels, inventoryTransactions, productVariants, products } from "@/infrastructure/db/schema";
import { brandScopeWhere } from "@/domains/admin/scope";
import { PageHead, Panel, Table, Badge, when } from "@/components/admin/ui";
import { ActionForm } from "@/components/ui/action-form";
import { adjustStockAction } from "@/app/actions/admin";

export default async function Inventory() {
  const { db, actor } = await adminCtx();
  const rows = await db.select({ v: productVariants, p: products, l: inventoryLevels }).from(inventoryLevels).innerJoin(productVariants, eq(productVariants.id, inventoryLevels.variantId)).innerJoin(products, eq(products.id, productVariants.productId)).where(brandScopeWhere(actor, "inventory.read", products.brandId)).limit(300);
  const hist = rows.length ? await db.select().from(inventoryTransactions).where(inArray(inventoryTransactions.variantId, rows.map((r) => r.v.id))).orderBy(desc(inventoryTransactions.createdAt)).limit(40) : [];
  const sku = new Map(rows.map((r) => [r.v.id, r.v.sku]));
  return (<div><PageHead title="Inventory" sub="available = on hand − reserved. Every change is recorded with a reason." />
    <Table head={["Product", "SKU", "On hand", "Reserved", "Available", "Status"]} rows={rows.map(({ v, p, l }) => { const a = l.onHand - l.reserved; return [p.name, v.sku, l.onHand, l.reserved, a, a <= 0 ? <Badge key="s" tone="bad">Out</Badge> : a <= l.lowStockThreshold ? <Badge key="s" tone="warn">Low</Badge> : <Badge key="s" tone="ok">OK</Badge>]; })} empty="No stocked variants in your scope." />
    {rows.length > 0 && <Panel title="Adjust stock"><div className="max-w-md"><ActionForm action={adjustStockAction} submitLabel="Apply adjustment" fields={[{ name: "variantId", label: "Variant", type: "select", options: rows.map((r) => [r.v.id, `${r.p.name} — ${r.v.sku}`]) }, { name: "type", label: "Type", type: "select", options: [["receive", "Stock received"], ["adjust", "Manual adjustment"], ["return", "Customer return"], ["correction", "Correction"]] }, { name: "delta", label: "Change (negative to remove)", type: "number" }, { name: "reason", label: "Reason", hint: "Required; kept in the audit trail." }, { name: "confirm", label: "I confirm this large adjustment (20+ units)", type: "checkbox", required: false }]} /></div></Panel>}
    <Panel title="Recent movements"><Table head={["When", "SKU", "Type", "On hand Δ", "Reserved Δ", "Reason"]} rows={hist.map((h) => [when(h.createdAt), sku.get(h.variantId), h.type, h.onHandDelta, h.reservedDelta, h.reason ?? h.referenceId ?? ""])} /></Panel></div>);
}
