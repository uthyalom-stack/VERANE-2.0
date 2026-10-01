import { describe, it, expect } from "vitest";
import { MediaService } from "../src/infrastructure/storage/media-service";
import { MockStorageProvider } from "../src/infrastructure/storage/mock-storage-provider";

describe("Media Storage Infrastructure Smoke Test", () => {
  const provider = new MockStorageProvider();
  const mediaService = new MediaService(provider);

  it("should upload, retrieve, and delete media object via abstraction", async () => {
    const key = `campaigns/2026/look-01-${Date.now()}.jpg`;
    const content = "fake-binary-image-data-stream";

    // 1. Upload
    const publicUrl = await mediaService.uploadMedia({
      key,
      body: content,
      contentType: "image/jpeg",
    });

    expect(publicUrl).toContain(key);

    // 2. Retrieve
    const retrieved = await mediaService.getMedia(key);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.contentType).toBe("image/jpeg");

    const decodedContent = new TextDecoder().decode(retrieved?.content);
    expect(decodedContent).toBe(content);

    // 3. Delete & Verify
    const deleted = await mediaService.deleteMedia(key);
    expect(deleted).toBe(true);

    const afterDelete = await mediaService.getMedia(key);
    expect(afterDelete).toBeNull();
  });
});
