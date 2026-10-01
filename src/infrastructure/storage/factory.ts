import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { StorageProvider } from "./storage-provider";
import { R2StorageProvider, type R2Config } from "./r2-storage-provider";
import { WorkerR2StorageProvider, type R2BucketBinding } from "./worker-r2-storage-provider";
import { MockStorageProvider } from "./mock-storage-provider";

export interface StorageFactoryOptions {
  workerBucket?: R2BucketBinding;
  r2Config?: R2Config;
  publicUrl?: string;
  forceMock?: boolean;
}

export function createStorageProvider(options: StorageFactoryOptions = {}): StorageProvider {
  // 1. Explicit mock override (used in isolated unit testing)
  if (options.forceMock) {
    return new MockStorageProvider(options.publicUrl);
  }

  // 2. Explicit Worker bucket binding passed in
  if (options.workerBucket) {
    return new WorkerR2StorageProvider(options.workerBucket, options.publicUrl);
  }

  // 3. Resolve Cloudflare Worker runtime binding via getCloudflareContext()
  try {
    const { env } = getCloudflareContext();
    if (env && (env as Record<string, unknown>).MEDIA_BUCKET) {
      const binding = (env as Record<string, unknown>).MEDIA_BUCKET as R2BucketBinding;
      return new WorkerR2StorageProvider(binding, options.publicUrl);
    }
  } catch {
    // Safely ignore when executing outside Cloudflare Worker runtime (Node.js/Vitest)
  }

  // 4. Non-Worker S3-compatible R2 adapter (when S3 credentials are intentionally supplied)
  if (options.r2Config && options.r2Config.accessKeyId && options.r2Config.secretAccessKey) {
    return new R2StorageProvider(options.r2Config);
  }

  // 5. Default fallback for local isolated development
  return new MockStorageProvider(options.publicUrl);
}
