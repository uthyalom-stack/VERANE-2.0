"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Uploads with a stable `uploadId` so a retry after a failed request is idempotent server-side. Shows progress/failed/retry states. */
export function MediaUploader({ brands }: { brands: Array<{ id: string; name: string }> }) {
  const router = useRouter(); const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ phase: "idle" | "uploading" | "failed" | "done"; msg?: string }>({ phase: "idle" });
  const [pending, setPending] = useState<{ file: File; uploadId: string } | null>(null);
  const [brandId, setBrandId] = useState(brands[0]?.id ?? ""); const [alt, setAlt] = useState("");

  async function send(file: File, uploadId: string) {
    setState({ phase: "uploading" });
    const fd = new FormData(); fd.set("file", file); fd.set("uploadId", uploadId); fd.set("brandId", brandId); fd.set("altText", alt);
    try {
      const res = await fetch("/api/admin/media", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setState({ phase: res.status >= 500 ? "failed" : "failed", msg: j.error ?? "Upload failed" }); setPending(res.status >= 500 ? { file, uploadId } : null); return; }
      setState({ phase: "done", msg: "Uploaded" }); setPending(null); setAlt(""); if (input.current) input.current.value = ""; router.refresh();
    } catch { setState({ phase: "failed", msg: "Network problem. Retry." }); setPending({ file, uploadId }); }
  }
  return (
    <div className="grid max-w-xl gap-3">
      <div className="grid gap-1"><label htmlFor="mu-brand" className="text-sm">Brand</label><select id="mu-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)} className="min-h-11 rounded-[var(--r-sm)] border border-line bg-surface px-3">{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
      <div className="grid gap-1"><label htmlFor="mu-alt" className="text-sm">Alt text (required for images)</label><input id="mu-alt" value={alt} onChange={(e) => setAlt(e.target.value)} className="min-h-11 rounded-[var(--r-sm)] border border-line bg-surface px-3" /></div>
      <div className="grid gap-1"><label htmlFor="mu-file" className="text-sm">File (JPEG, PNG, WebP, AVIF, GIF, MP4, WebM, GLB)</label><input ref={input} id="mu-file" type="file" accept="image/*,video/mp4,video/webm,.glb" className="text-sm" onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f, crypto.randomUUID()); }} /></div>
      <p role="status" aria-live="polite" className={`text-sm ${state.phase === "failed" ? "text-red-400" : "text-accent"}`}>{state.phase === "uploading" ? "Uploading…" : state.msg}</p>
      {pending && <Button type="button" variant="outline" onClick={() => void send(pending.file, pending.uploadId)}>Retry upload</Button>}
    </div>
  );
}
