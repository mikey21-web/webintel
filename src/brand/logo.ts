import { randomUUID } from 'crypto';
import { fetch } from 'undici';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';

function getR2Client(): S3Client | null {
  if (!config.R2_ACCOUNT_ID || !config.R2_ACCESS_KEY_ID || !config.R2_SECRET_ACCESS_KEY) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    },
  });
}

interface LogoResult {
  url: string;
  cdnUrl: string;
  width: number;
  height: number;
  format: string;
  source: 'og' | 'apple-touch' | 'favicon' | 'img-tag' | 'google-fallback';
}

function normalizeUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return null;
    return buf;
  } catch {
    return null;
  }
}

const WEB_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif']);

async function processToWebFormat(buffer: Buffer): Promise<{ buffer: Buffer; format: string; width: number; height: number } | null> {
  try {
    const meta = await sharp(buffer).metadata();
    const format = meta.format || 'png';
    const width = meta.width || 0;
    const height = meta.height || 0;
    if (WEB_FORMATS.has(format)) {
      return { buffer, format, width, height };
    }
    const pngBuf = await sharp(buffer).png().toBuffer();
    return { buffer: pngBuf, format: 'png', width, height };
  } catch {
    return null;
  }
}

async function uploadToR2(domain: string, buffer: Buffer, format: string): Promise<string> {
  const r2 = getR2Client();
  if (!r2) return '';
  const ext = format === 'jpeg' ? 'jpg' : format;
  const key = `logos/${domain}/${randomUUID()}.${ext}`;
  const contentType = `image/${format === 'jpeg' ? 'jpeg' : format}`;
  await r2.send(new PutObjectCommand({
    Bucket: config.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return `${config.R2_PUBLIC_URL}/${key}`;
}

async function trySource(url: string, domain: string, source: LogoResult['source']): Promise<LogoResult | null> {
  const buf = await fetchImageBuffer(url);
  if (!buf) return null;
  const processed = await processToWebFormat(buf);
  if (!processed) return null;
  const { buffer, format, width, height } = processed;
  const cdnUrl = await uploadToR2(domain, buffer, format);
  return { url, cdnUrl, width, height, format, source };
}

export async function extractLogo($: any, baseUrl: string): Promise<LogoResult | null> {
  const domain = new URL(baseUrl).hostname;

  const sources: { url: string; source: LogoResult['source'] }[] = [];

  const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="og:image"]').attr('content');
  if (ogImage) sources.push({ url: normalizeUrl(ogImage, baseUrl), source: 'og' });

  const appleTouch = $('link[rel="apple-touch-icon"]').attr('href');
  if (appleTouch) sources.push({ url: normalizeUrl(appleTouch, baseUrl), source: 'apple-touch' });

  $('link[rel="icon"], link[rel="shortcut icon"]').each((_: number, el: any) => {
    const href = $(el).attr('href');
    if (href) sources.push({ url: normalizeUrl(href, baseUrl), source: 'favicon' });
  });

  $('img[class*="logo"], img[alt*="logo"], header img').each((_: number, el: any) => {
    const src = $(el).attr('src');
    if (src) sources.push({ url: normalizeUrl(src, baseUrl), source: 'img-tag' });
  });

  const deduped = sources.filter((s, i, arr) => arr.findIndex(x => x.url === s.url) === i).slice(0, 5);

  const promises = deduped.map(({ url, source }) =>
    (async () => {
      const result = await trySource(url, domain, source);
      if (!result) throw new Error('failed');
      return result;
    })()
  );

  if (promises.length > 0) {
    try {
      return await Promise.any(promises);
    } catch {
      // all failed, fall through to fallback
    }
  }

  const googleFallback = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  const result = await trySource(googleFallback, domain, 'google-fallback');
  if (result) return result;

  return null;
}
