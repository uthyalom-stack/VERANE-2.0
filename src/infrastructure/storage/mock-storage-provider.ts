import type { StorageProvider, UploadOptions, StorageObject } from "./storage-provider";

export class MockStorageProvider implements StorageProvider {
  private store = new Map<string, { content: Uint8Array; contentType?: string; metadata?: Record<string, string> }>();
  private baseUrl: string;

  constructor(baseUrl = "http://localhost:3000/media") {
    this.baseUrl = baseUrl;
  }

  async upload(options: UploadOptions): Promise<string> {
    let content: Uint8Array;
    if (typeof options.body === "string") {
      content = new TextEncoder().encode(options.body);
    } else if (options.body instanceof Blob) {
      content = new Uint8Array(await options.body.arrayBuffer());
    } else if (Buffer.isBuffer(options.body)) {
      content = new Uint8Array(options.body);
    } else {
      content = options.body;
    }

    this.store.set(options.key, {
      content,
      contentType: options.contentType,
      metadata: options.metadata,
    });

    return this.getPublicUrl(options.key);
  }

  async retrieve(key: string): Promise<StorageObject | null> {
    const item = this.store.get(key);
    if (!item) return null;

    return {
      key,
      content: item.content,
      contentType: item.contentType,
      contentLength: item.content.byteLength,
    };
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  getPublicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}
