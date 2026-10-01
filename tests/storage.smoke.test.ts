import { describe, it, expect } from "vitest";
import { MediaService } from "../src/infrastructure/storage/media-service";
import { MockStorageProvider } from "../src/infrastructure/storage/mock-storage-provider";
import { type R2BucketBinding } from "../src/infrastructure/storage/worker-r2-storage-provider";
import { createStorageProvider } from "../src/infrastructure/storage/factory";

describe("Media Storage Infrastructure Smoke Test", () => {
  it("should upload, retrieve, and delete media object via MockStorageProvider", async () => {
    const provider = new MockStorageProvider();
    const mediaService = new MediaService(provider);
    const key = `campaigns/2026/look-01-${Date.now()}.jpg`;
    const content = "fake-binary-image-data-stream";

    const publicUrl = await mediaService.uploadMedia({
      key,
      body: content,
      contentType: "image/jpeg",
    });

    expect(publicUrl).toContain(key);

    const retrieved = await mediaService.getMedia(key);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.contentType).toBe("image/jpeg");

    const decodedContent = new TextDecoder().decode(retrieved?.content);
    expect(decodedContent).toBe(content);

    const deleted = await mediaService.deleteMedia(key);
    expect(deleted).toBe(true);

    const afterDelete = await mediaService.getMedia(key);
    expect(afterDelete).toBeNull();
  });

  it("should upload, retrieve, and delete media object via WorkerR2StorageProvider binding", async () => {
    const memoryStore = new Map<string, { body: ArrayBuffer; contentType?: string; metadata?: Record<string, string> }>();

    const mockR2Binding: R2BucketBinding = {
      async put(key, value, options) {
        let buffer: ArrayBuffer;
        if (typeof value === "string") {
          buffer = new TextEncoder().encode(value).buffer;
        } else if (value instanceof ArrayBuffer) {
          buffer = value;
        } else {
          buffer = new ArrayBuffer(0);
        }
        memoryStore.set(key, { body: buffer, contentType: options?.httpMetadata?.contentType, metadata: options?.customMetadata });
      },
      async get(key) {
        const item = memoryStore.get(key);
        if (!item) return null;
        return {
          async arrayBuffer() {
            return item.body;
          },
          httpMetadata: { contentType: item.contentType },
          size: item.body.byteLength,
        };
      },
      async delete(key) {
        memoryStore.delete(key);
      },
    };

    const workerProvider = createStorageProvider({ workerBucket: mockR2Binding });
    const mediaService = new MediaService(workerProvider);
    const key = `worker-tests/look-02-${Date.now()}.jpg`;
    const content = "worker-r2-data";

    const url = await mediaService.uploadMedia({ key, body: content, contentType: "image/jpeg" });
    expect(url).toContain(key);

    const retrieved = await mediaService.getMedia(key);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.contentType).toBe("image/jpeg");

    const deleted = await mediaService.deleteMedia(key);
    expect(deleted).toBe(true);

    const afterDelete = await mediaService.getMedia(key);
    expect(afterDelete).toBeNull();
  });
});
