"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/http/action";

export type FieldDef = { name: string; label: string; type?: string; autoComplete?: string; required?: boolean; defaultValue?: string; hint?: string; options?: Array<[string, string]>; rows?: number; step?: string };

/** Accessible form bound to a server action: labelled inputs, per-field errors, polite status region, pending state. */
export function ActionForm({ action, fields, submitLabel, hidden = {}, footer }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; fields: FieldDef[]; submitLabel: string; hidden?: Record<string, string>; footer?: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, { ok: false } as ActionState);
  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {fields.map((f) => {
        const err = state.fieldErrors?.[f.name]?.[0];
        if (f.type === "checkbox") return (
          <label key={f.name} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name={f.name} defaultChecked={f.defaultValue === "on"} className="size-5 accent-[var(--accent)]" />{f.label}</label>);
        const common = { id: f.name, name: f.name, required: f.required ?? true, defaultValue: f.defaultValue, "aria-invalid": !!err, "aria-describedby": err ? `${f.name}-err` : f.hint ? `${f.name}-hint` : undefined, className: "rounded-[var(--r-sm)] border border-line bg-surface px-4 aria-[invalid=true]:border-red-400" };
        if (f.type === "checkboxes") return (
          <fieldset key={f.name} className="grid gap-2"><legend className="text-sm">{f.label}</legend><div className="flex flex-wrap gap-x-5 gap-y-1">{(f.options ?? []).map(([v, l]) => <label key={v} className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" name={f.name} value={v} defaultChecked={(f.defaultValue ?? "").split(",").includes(v)} className="size-4 accent-[var(--accent)]" />{l}</label>)}</div></fieldset>);
        if (f.type === "textarea" || f.type === "select") return (
          <div key={f.name} className="grid gap-1.5"><label htmlFor={f.name} className="text-sm">{f.label}</label>
            {f.type === "textarea" ? <textarea {...common} rows={f.rows ?? 4} className={common.className + " py-3"} /> : <select {...common} className={common.className + " min-h-12"}>{(f.options ?? []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
            {f.hint && !err && <p id={`${f.name}-hint`} className="text-xs text-muted">{f.hint}</p>}{err && <p id={`${f.name}-err`} className="text-xs text-red-400">{err}</p>}</div>);
        return (
          <div key={f.name} className="grid gap-1.5">
            <label htmlFor={f.name} className="text-sm">{f.label}</label>
            <input step={f.step} id={f.name} name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} required={f.required ?? true} defaultValue={f.defaultValue}
              aria-invalid={!!err} aria-describedby={err ? `${f.name}-err` : f.hint ? `${f.name}-hint` : undefined}
              className="min-h-12 rounded-[var(--r-sm)] border border-line bg-surface px-4 aria-[invalid=true]:border-red-400" />
            {f.hint && !err && <p id={`${f.name}-hint`} className="text-xs text-muted">{f.hint}</p>}
            {err && <p id={`${f.name}-err`} className="text-xs text-red-400">{err}</p>}
          </div>
        );
      })}
      <div role="status" aria-live="polite" className="min-h-5 text-sm">{state.message && <p className={state.ok ? "text-accent" : "text-red-400"}>{state.message}</p>}</div>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "One moment…" : submitLabel}</Button>
      {footer}
    </form>
  );
}
