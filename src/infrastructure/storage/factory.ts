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
  if (options.forceMock) {
    return new MockStorageProvider(options.publicUrl);
  }

  if (options.workerBucket) {
    return new WorkerR2StorageProvider(options.workerBucket, options.publicUrl);
  }

  if (options.r2Config && options.r2Config.accessKeyId && options.r2Config.secretAccessKey) {
    return new R2StorageProvider(options.r2Config);
  }

  return new MockStorageProvider(options.publicUrl);
}
