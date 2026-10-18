import { NextResponse } from "next/server";
import { getDb } from "@/infrastructure/db/client";
import { getMediaStorage } from "@/infrastructure/storage";
import { getCurrentUser } from "@/lib/http/session";
import { loadActor } from "@/domains/authorization";
import { assertSameOrigin } from "@/lib/http/origin";
import { storeUpload, LIMITS } from "@/domains/media";
import { isAppError } from "@/lib/errors";

export const dynamic = "force-dynamic";
const MAX = Math.max(...Object.values(LIMITS));

/** multipart upload: fields `file`, `uploadId` (client-generated, makes retries idempotent), `brandId` (optional), `altText`. */
export async function POST(req: Request) {
  try {
    await assertSameOrigin();
    const u = await getCurrentUser();
    if (!u || u.kind !== "admin") return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX + 1_000_000) return NextResponse.json({ error: "File too large" }, { status: 413 });
    const form = await req.formData(); const file = form.get("file"); const uploadId = String(form.get("uploadId") ?? "");
    if (!(file instanceof File) || uploadId.length < 8 || uploadId.length > 80) return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
    if (file.size > MAX) return NextResponse.json({ error: "File too large" }, { status: 413 });
    const db = getDb(); const actor = await loadActor(db, u.id);
    const brandId = String(form.get("brandId") ?? "") || null;
    const row = await storeUpload(db, await getMediaStorage(), actor, { bytes: new Uint8Array(await file.arrayBuffer()), uploadId, brandId, altText: String(form.get("altText") ?? "") });
    return NextResponse.json({ id: row.id, key: row.storageKey, kind: row.kind });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: e.code === "FORBIDDEN" ? 403 : e.code === "UNAUTHENTICATED" ? 401 : 400 });
    console.error("[media:upload]", e); return NextResponse.json({ error: "Upload failed. Please retry." }, { status: 500 });
  }
}
