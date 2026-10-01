import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { StorageProvider, UploadOptions, StorageObject } from "./storage-provider";

export interface R2Config {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName: string;
  publicUrl?: string;
}

export class R2StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor(config: R2Config) {
    this.bucketName = config.bucketName;
    this.publicUrl = config.publicUrl || `https://${config.bucketName}.r2.cloudflarestorage.com`;

    const endpoint = config.accountId
      ? `https://${config.accountId}.r2.cloudflarestorage.com`
      : "http://localhost:9000";

    this.client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId: config.accessKeyId || "mock",
        secretAccessKey: config.secretAccessKey || "mock",
      },
    });
  }

  async upload(options: UploadOptions): Promise<string> {
    const bodyBuffer =
      typeof options.body === "string"
        ? Buffer.from(options.body)
        : options.body instanceof Blob
        ? Buffer.from(await options.body.arrayBuffer())
        : options.body;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: options.key,
        Body: bodyBuffer,
        ContentType: options.contentType,
        Metadata: options.metadata,
      })
    );

    return this.getPublicUrl(options.key);
  }

  async retrieve(key: string): Promise<StorageObject | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );

      if (!response.Body) return null;

      const bytes = await response.Body.transformToByteArray();

      return {
        key,
        content: bytes,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
      };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl.replace(/\/$/, "")}/${key}`;
  }
}
