import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/lib/env";
import { track, type TrackInput } from "@/domains/analytics";

/** Never throws, never awaited on the critical path by callers that don't need it. */
export async function trackServer(e: TrackInput): Promise<void> {
  try { await track(getDb(), getEnv(), e); } catch { /* analytics must never affect shopping */ }
}
