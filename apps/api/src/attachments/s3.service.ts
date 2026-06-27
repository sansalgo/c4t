import { Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// Allowed upload types (server-authoritative whitelist).
export const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'application/pdf',
  'video/mp4',
  'video/quicktime',
]);

const CONTENT_TYPE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

const PRESIGN_PUT_TTL = 600;  // 10 min — time to upload
const PRESIGN_GET_TTL = 3600; // 1 hour — time to view

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  readonly bucket: string;
  readonly maxSizeBytes: number;

  constructor() {
    this.bucket = process.env.S3_BUCKET ?? '';
    this.maxSizeBytes = parseInt(process.env.S3_MAX_SIZE_BYTES ?? '52428800', 10); // 50 MB

    this.client = new S3Client({
      region: process.env.S3_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
      // R2 / MinIO support — set S3_ENDPOINT to override the default AWS endpoint.
      ...(process.env.S3_ENDPOINT
        ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true }
        : {}),
    });

    if (!this.bucket) {
      this.logger.warn('S3_BUCKET is not set — file attachment endpoints will fail at runtime');
    }
  }

  generateKey(familyId: string, taskId: string, contentType: string): string {
    const ext = CONTENT_TYPE_EXT[contentType] ?? 'bin';
    return `families/${familyId}/tasks/${taskId}/${randomUUID()}.${ext}`;
  }

  async createPresignedPutUrl(key: string, contentType: string): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: PRESIGN_PUT_TTL });
  }

  async createPresignedGetUrl(key: string): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: PRESIGN_GET_TTL });
  }

  async headObject(key: string): Promise<HeadObjectCommandOutput> {
    const cmd = new HeadObjectCommand({ Bucket: this.bucket, Key: key });
    return this.client.send(cmd);
  }

  async deleteObject(key: string): Promise<void> {
    const cmd = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
    await this.client.send(cmd);
    this.logger.debug(`Deleted S3 object: ${key}`);
  }
}
