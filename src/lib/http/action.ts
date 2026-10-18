import { ZodError } from "zod";
import { assertSameOrigin } from "./origin";
import { isAppError } from "@/lib/errors";

export type ActionState<T = undefined> = { ok: boolean; message?: string; fieldErrors?: Record<string, string[]>; data?: T };
export const initialState: ActionState = { ok: false };

/**
 * Wraps every server action: same-origin check, uniform error mapping, and re-throws Next control-flow errors
 * (redirect/notFound). Internal errors are logged server-side and replaced by a generic message.
 */
export async function run<T = undefined>(fn: () => Promise<ActionState<T> | void>, opts: { skipOrigin?: boolean } = {}): Promise<ActionState<T>> {
  try {
    if (!opts.skipOrigin) await assertSameOrigin();
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    if (e instanceof ZodError) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: e.flatten().fieldErrors as Record<string, string[]> };
    if (isAppError(e)) return { ok: false, message: e.message };
    console.error("[action:error]", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
export const fd = (f: FormData) => Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
