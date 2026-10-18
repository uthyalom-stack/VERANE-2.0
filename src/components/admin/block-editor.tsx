"use client";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/http/action";

export type BlockDef = { label: string; fields: Array<{ name: string; label: string; type?: "text" | "textarea" | "number" | "select"; options?: string[]; hint?: string }> };
type Block = { type: string; data: Record<string, unknown> };

/** Ordered block editor: add, reorder, remove, edit fields. The server re-validates every block against its schema on save. */
export function BlockEditor({ action, defs, initial, hidden, fieldName, statusField = false, extra, flat = false }: { flat?: boolean; action: (s: ActionState, f: FormData) => Promise<ActionState>; defs: Record<string, BlockDef>; initial: Block[]; hidden: Record<string, string>; fieldName: string; statusField?: boolean; extra?: React.ReactNode }) {
  const [blocks, setBlocks] = useState<Block[]>(initial);
  const [state, act, pending] = useActionState(action, { ok: false } as ActionState);
  const [add, setAdd] = useState(Object.keys(defs)[0]!);
  const upd = (i: number, k: string, v: unknown) => setBlocks((b) => b.map((x, n) => (n === i ? { ...x, data: { ...x.data, [k]: v } } : x)));
  const move = (i: number, d: number) => setBlocks((b) => { const j = i + d; if (j < 0 || j >= b.length) return b; const n = [...b]; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  return (
    <form action={act} className="grid gap-4">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name={fieldName} value={JSON.stringify(flat ? blocks.map((b) => ({ type: b.type, ...b.data })) : blocks)} />
      {extra}
      <ol className="grid gap-3">{blocks.map((b, i) => { const def = defs[b.type]; return (
        <li key={i} className="rounded-[var(--r-md)] border border-line p-4">
          <div className="mb-3 flex items-center justify-between"><strong className="text-sm">{def?.label ?? b.type}</strong>
            <span className="flex gap-1"><Button type="button" variant="ghost" onClick={() => move(i, -1)} aria-label={`Move block ${i + 1} up`}>↑</Button><Button type="button" variant="ghost" onClick={() => move(i, 1)} aria-label={`Move block ${i + 1} down`}>↓</Button><Button type="button" variant="ghost" onClick={() => setBlocks((x) => x.filter((_, n) => n !== i))}>Remove</Button></span></div>
          <div className="grid gap-3 md:grid-cols-2">{def?.fields.map((f) => { const val = String(b.data[f.name] ?? ""); const id = `b${i}-${f.name}`; return (
            <div key={f.name} className={`grid gap-1 ${f.type === "textarea" ? "md:col-span-2" : ""}`}><label htmlFor={id} className="text-xs text-muted">{f.label}</label>
              {f.type === "textarea" ? <textarea id={id} value={val} rows={4} onChange={(e) => upd(i, f.name, e.target.value)} className="rounded-[var(--r-sm)] border border-line bg-surface px-3 py-2 text-sm" />
                : f.type === "select" ? <select id={id} value={val} onChange={(e) => upd(i, f.name, e.target.value)} className="min-h-11 rounded-[var(--r-sm)] border border-line bg-surface px-3 text-sm">{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
                : <input id={id} type={f.type === "number" ? "number" : "text"} value={val} onChange={(e) => upd(i, f.name, f.type === "number" ? Number(e.target.value) : e.target.value)} className="min-h-11 rounded-[var(--r-sm)] border border-line bg-surface px-3 text-sm" />}
              {f.hint && <p className="text-xs text-muted">{f.hint}</p>}</div>); })}</div></li>); })}</ol>
      {blocks.length === 0 && <p className="rounded-[var(--r-md)] border border-dashed border-line p-6 text-center text-sm text-muted">No blocks yet. Add one below.</p>}
      <div className="flex flex-wrap items-center gap-3"><label className="sr-only" htmlFor="add-type">Block type</label>
        <select id="add-type" value={add} onChange={(e) => setAdd(e.target.value)} className="min-h-11 rounded-[var(--r-sm)] border border-line bg-surface px-3 text-sm">{Object.entries(defs).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}</select>
        <Button type="button" variant="outline" onClick={() => setBlocks((b) => [...b, { type: add, data: {} }])}>Add block</Button></div>
      <div className="flex flex-wrap items-center gap-3">
        {statusField ? <><Button type="submit" name="status" value="draft" variant="outline" disabled={pending}>Save draft</Button><Button type="submit" name="status" value="published" disabled={pending}>Publish</Button></> : <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>}
        <p role="status" aria-live="polite" className={`text-sm ${state.ok ? "text-accent" : "text-red-400"}`}>{state.message}</p></div>
    </form>
  );
}
