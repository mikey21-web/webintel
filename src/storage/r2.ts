import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.R2_ACCESS_KEY_ID,
    secretAccessKey: config.R2_SECRET_ACCESS_KEY,
  },
});

export async function uploadToR2(key: string, body: Buffer | Uint8Array | string, contentType?: string): Promise<string> {
  await r2.send(new PutObjectCommand({
    Bucket: config.R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return `${config.R2_PUBLIC_URL}/${key}`;
}

export async function getFromR2(key: string): Promise<Buffer | null> {
  try {
    const result = await r2.send(new GetObjectCommand({
      Bucket: config.R2_BUCKET_NAME,
      Key: key,
    }));
    return Buffer.from(await result.Body!.transformToByteArray());
  } catch {
    return null;
  }
}

export { uploadToR2 as r2Upload, getFromR2 as r2Get };
export const r2PublicUrl = config.R2_PUBLIC_URL;
