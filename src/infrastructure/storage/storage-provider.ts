export interface UploadOptions {
  key: string;
  body: Buffer | Uint8Array | Blob | string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface StorageObject {
  key: string;
  content: Uint8Array;
  contentType?: string;
  contentLength?: number;
}

export interface StorageProvider {
  upload(options: UploadOptions): Promise<string>;
  retrieve(key: string): Promise<StorageObject | null>;
  delete(key: string): Promise<boolean>;
  getPublicUrl(key: string): string;
}
