import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { StoragePort, StoredObject } from './storage.port';

/** AWS S3 ou qualquer storage S3-compatível (Supabase Storage, Cloudflare R2, MinIO). */
@Injectable()
export class S3StorageAdapter extends StoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: AppConfig) {
    super();
    const s3 = config.storage.s3;
    if (!s3.bucket) throw new Error('S3_BUCKET é obrigatório com STORAGE_DRIVER=s3');
    this.bucket = s3.bucket;
    this.publicUrl = s3.publicUrl || `https://${s3.bucket}.s3.${s3.region}.amazonaws.com`;
    this.client = new S3Client({
      region: s3.region,
      endpoint: s3.endpoint || undefined,
      forcePathStyle: Boolean(s3.endpoint),
      credentials: s3.accessKeyId
        ? { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey }
        : undefined,
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return { key, url: `${this.publicUrl.replace(/\/$/, '')}/${key}` };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
