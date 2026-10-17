import { adminCtx } from "@/lib/admin";
import { listArchivedProductsForAdmin } from "@/domains/catalog/admin";
import { restoreArchivedProductAction } from "@/app/actions/admin";
import { brands } from "@/infrastructure/db/schema";
import { PageHead, Table, Badge, statusTone, A, when } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ProductHistory() {
  const { db, actor } = await adminCtx();
  const [archived, brandRows] = await Promise.all([
    listArchivedProductsForAdmin(db, actor),
    db.select({ id: brands.id, name: brands.name }).from(brands),
  ]);
  const brandNames = new Map(brandRows.map((b) => [b.id, b.name]));

  return (
    <div>
      <PageHead title="Product archive" sub="Archived products are hidden from the storefront. Restoring one returns it to draft; publishing remains a separate, deliberate action." action={<A href="/admin/products">Back to products</A>} />
      <Table
        head={["Product", "Brand", "Price", "Archived", "Action"]}
        rows={archived.map((p) => [
          <div key={p.id}><A href={`/admin/products/${p.id}`}>{p.name}</A><p className="mt-1 text-xs text-muted">{p.slug}</p></div>,
          brandNames.get(p.brandId) ?? "Unknown brand",
          formatMoney(p.basePrice, p.currency),
          when(p.archivedAt ?? p.updatedAt),
          <form key={p.id} action={restoreArchivedProductAction.bind(null, p.id)}>
            <button type="submit" className="rounded border border-line px-3 py-2 text-xs hover:bg-surface">Restore as draft</button>
          </form>,
        ])}
        empty="No archived products in your brand scope."
      />
    </div>
  );
}
