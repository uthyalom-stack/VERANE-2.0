import type { StorageProvider, UploadOptions, StorageObject } from "./storage-provider";

export class MediaService {
  constructor(private readonly provider: StorageProvider) {}

  async uploadMedia(options: UploadOptions): Promise<string> {
    return this.provider.upload(options);
  }

  async getMedia(key: string): Promise<StorageObject | null> {
    return this.provider.retrieve(key);
  }

  async deleteMedia(key: string): Promise<boolean> {
    return this.provider.delete(key);
  }

  getMediaUrl(key: string): string {
    return this.provider.getPublicUrl(key);
  }
}
