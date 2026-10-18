import { getEnv } from "@/lib/env";

/** Storage abstraction. Drivers: local (dev, ./local-media) and r2 (Workers binding MEDIA_BUCKET). Upload drivers: see PROGRESS.md. */
export interface MediaStorage {
  put(key: string, body: ArrayBuffer | ReadableStream, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

/** URL for a stored asset. Placeholders ship in /public and are always served locally. */
export function mediaUrl(storageKey: string): string {
  if (storageKey.startsWith("placeholders/")) return `/${storageKey}`;
  return `${getEnv().MEDIA_PUBLIC_BASE_URL.replace(/\/$/, "")}/${storageKey}`;
}

/** Pick the storage driver. R2 uses the Workers binding (no credentials in code); local writes to ./local-media for development only. */
export async function getMediaStorage(): Promise<MediaStorage> {
  const env = getEnv();
  if (env.MEDIA_DRIVER === "r2") {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const bucket = (await getCloudflareContext({ async: true })).env.MEDIA_BUCKET as R2BucketLike | undefined;
    if (!bucket) throw new Error("R2 binding MEDIA_BUCKET is not configured (see wrangler.jsonc)");
    return r2Storage(bucket);
  }
  if (env.APP_ENV === "production") throw new Error("Local media storage is not allowed in production");
  return localStorageDriver();
}

export type R2BucketLike = {
  put(key: string, value: ArrayBuffer | Uint8Array | ReadableStream, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string, opts?: { range?: { offset: number; length?: number } }): Promise<null | { body: ReadableStream; size: number; httpMetadata?: { contentType?: string }; httpEtag: string; range?: { offset: number; length: number } }>;
  delete(key: string): Promise<void>;
};
export function r2Storage(bucket: R2BucketLike): MediaStorage & { bucket: R2BucketLike } {
  return { bucket, publicUrl: mediaUrl, async put(key, body, contentType) { await bucket.put(key, body as never, { httpMetadata: { contentType } }); }, async delete(key) { await bucket.delete(key); } };
}
async function localStorageDriver(): Promise<MediaStorage> {
  const fs = await import("node:fs/promises"); const path = await import("node:path");
  const root = path.resolve(process.cwd(), "local-media");
  return {
    publicUrl: mediaUrl,
    async put(key, body) { const f = path.join(root, key); await fs.mkdir(path.dirname(f), { recursive: true }); await fs.writeFile(f, new Uint8Array(body as ArrayBuffer)); },
    async delete(key) { await fs.rm(path.join(root, key), { force: true }); },
  };
}
