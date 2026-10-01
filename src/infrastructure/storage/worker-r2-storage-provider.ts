import type { StorageProvider, UploadOptions, StorageObject } from "./storage-provider";

export interface R2BucketBinding {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }
  ): Promise<unknown>;
  get(key: string): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    httpMetadata?: { contentType?: string };
    size?: number;
  } | null>;
  delete(key: string): Promise<void>;
}

export class WorkerR2StorageProvider implements StorageProvider {
  constructor(
    private readonly bucket: R2BucketBinding,
    private readonly publicUrl: string = "http://localhost:3000/media"
  ) {}

  async upload(options: UploadOptions): Promise<string> {
    let body: ArrayBufferView | ArrayBuffer | string | Blob;
    if (typeof options.body === "string" || options.body instanceof Blob) {
      body = options.body;
    } else if (Buffer.isBuffer(options.body)) {
      body = new Uint8Array(options.body);
    } else if (options.body instanceof Uint8Array) {
      body = options.body;
    } else {
      body = options.body;
    }

    await this.bucket.put(options.key, body, {
      httpMetadata: { contentType: options.contentType },
      customMetadata: options.metadata,
    });

    return this.getPublicUrl(options.key);
  }

  async retrieve(key: string): Promise<StorageObject | null> {
    try {
      const object = await this.bucket.get(key);
      if (!object) return null;

      const buffer = await object.arrayBuffer();
      const content = new Uint8Array(buffer);

      return {
        key,
        content,
        contentType: object.httpMetadata?.contentType,
        contentLength: object.size ?? content.byteLength,
      };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.bucket.delete(key);
      return true;
    } catch {
      return false;
    }
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl.replace(/\/$/, "")}/${key}`;
  }
}
