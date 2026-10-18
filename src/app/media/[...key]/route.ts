import { getEnv } from "@/lib/env";
import { getMediaStorage, type R2BucketLike } from "@/infrastructure/storage";

export const dynamic = "force-dynamic";
const OK_KEY = /^(image|video|model3d)\/[a-f0-9]{32}\.(jpg|png|gif|webp|avif|mp4|webm|glb)$/;
const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", avif: "image/avif", mp4: "video/mp4", webm: "video/webm", glb: "model/gltf-binary" };

/** Serves stored media (R2 binding in production, ./local-media in dev). Keys are validated strictly; files are content-addressed so they cache forever. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  if (!OK_KEY.test(key)) return new Response("Not found", { status: 404 });
  const headers = new Headers({ "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes", "Content-Type": MIME[key.split(".").pop()!]! });
  if (getEnv().MEDIA_DRIVER === "r2") {
    const storage = (await getMediaStorage()) as { bucket?: R2BucketLike };
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.get("range") ?? "");
    const obj = await storage.bucket!.get(key, range ? { range: { offset: Number(range[1]), ...(range[2] ? { length: Number(range[2]) - Number(range[1]) + 1 } : {}) } } : undefined);
    if (!obj) return new Response("Not found", { status: 404 });
    if (range && obj.range) { headers.set("Content-Range", `bytes ${obj.range.offset}-${obj.range.offset + obj.range.length - 1}/${obj.size}`); headers.set("Content-Length", String(obj.range.length)); return new Response(obj.body, { status: 206, headers }); }
    headers.set("Content-Length", String(obj.size)); headers.set("ETag", obj.httpEtag); return new Response(obj.body, { headers });
  }
  if (getEnv().APP_ENV === "production") return new Response("Not found", { status: 404 });
  try {
    const fs = await import("node:fs/promises"); const path = await import("node:path");
    const data = await fs.readFile(path.join(process.cwd(), "local-media", key));
    headers.set("Content-Length", String(data.byteLength)); return new Response(data, { headers });
  } catch { return new Response("Not found", { status: 404 }); }
}
