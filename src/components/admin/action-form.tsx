"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/http/action";

type AdminAction = (previous: ActionState, formData: FormData) => Promise<ActionState>;

export function AdminActionForm({
  action,
  children,
  submitLabel = "Save changes",
}: {
  action: AdminAction;
  children: ReactNode;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false, message: "" });
  return (
    <form action={formAction} className="space-y-4">
      {children}
      <button type="submit" disabled={pending} className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Saving…" : submitLabel}
      </button>
      {state.message ? <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p> : null}
    </form>
  );
}

export function AdminField({ label, name, defaultValue = "", type = "text", required = false, hint }: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-neutral-800">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} required={required} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-950 outline-none focus:border-neutral-900" />
      {hint ? <span className="block text-xs text-neutral-500">{hint}</span> : null}
    </label>
  );
}

export function AdminSelect({ label, name, defaultValue, options, required = false }: {
  label: string;
  name: string;
  defaultValue?: string;
  options: Array<{ label: string; value: string }>;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-neutral-800">{label}</span>
      <select name={name} defaultValue={defaultValue} required={required} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-950 outline-none focus:border-neutral-900">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
