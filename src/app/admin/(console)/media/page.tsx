import { adminCtx } from "@/lib/admin";
import { brands } from "@/infrastructure/db/schema";
import { listMedia } from "@/domains/media";
import { can } from "@/domains/authorization";
import { PageHead, Panel, Badge } from "@/components/admin/ui";
import { MediaUploader } from "@/components/admin/media-uploader";
import { ActionForm } from "@/components/ui/action-form";
import { updateAltAction } from "@/app/actions/admin";
import { Media } from "@/components/ui/media";
export default async function MediaPage() {
  const { db, actor } = await adminCtx(); const [list, bs] = await Promise.all([listMedia(db, actor), db.select().from(brands)]);
  return (<div><PageHead title="Media" sub="Files are validated by content, not by filename. Images need alt text." />
    <Panel title="Upload"><MediaUploader brands={bs.filter((b) => can(actor, "media.write", b.id)).map((b) => ({ id: b.id, name: b.name }))} /></Panel>
    <ul className="grid grid-cols-2 gap-6 md:grid-cols-4">{list.map((m) => <li key={m.id} className="text-xs"><div className="aspect-square overflow-hidden rounded bg-surface">{m.kind === "image" ? <Media storageKey={m.storageKey} alt={m.altText ?? ""} /> : <div className="grid h-full place-items-center">{m.kind}</div>}</div>
      <p className="mt-1 flex items-center gap-2">{m.kind}{m.isPlaceholder && <Badge tone="warn">placeholder</Badge>}</p><p className="text-muted">{m.width ? `${m.width}×${m.height} · ` : ""}{Math.round(m.byteSize / 1024)} KB</p>
      <ActionForm action={updateAltAction} submitLabel="Save alt" hidden={{ id: m.id }} fields={[{ name: "altText", label: "Alt text", required: false, defaultValue: m.altText ?? "" }]} /></li>)}</ul>
    {list.length === 0 && <p className="text-sm text-muted">No media uploaded yet.</p>}</div>);
}
