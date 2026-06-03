import { randomUUID } from 'crypto';
import { fetch } from 'undici';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.R2_ACCESS_KEY_ID,
    secretAccessKey: config.R2_SECRET_ACCESS_KEY,
  },
});

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

async function toPng(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buffer).png().toBuffer();
  } catch {
    return null;
  }
}

async function uploadToR2(domain: string, buffer: Buffer): Promise<string> {
  const key = `logos/${domain}/${randomUUID()}.png`;
  await r2.send(new PutObjectCommand({
    Bucket: config.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: 'image/png',
  }));
  return `${config.R2_PUBLIC_URL}/${key}`;
}

async function getDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  try {
    const meta = await sharp(buffer).metadata();
    return { width: meta.width || 0, height: meta.height || 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}

async function trySource(url: string, domain: string, source: LogoResult['source']): Promise<LogoResult | null> {
  const buf = await fetchImageBuffer(url);
  if (!buf) return null;
  const png = await toPng(buf);
  if (!png) return null;
  const { width, height } = await getDimensions(png);
  const cdnUrl = await uploadToR2(domain, png);
  return { url, cdnUrl, width, height, format: 'png', source };
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

  const deduped = sources.filter((s, i, arr) => arr.findIndex(x => x.url === s.url) === i);

  for (const { url, source } of deduped) {
    const result = await trySource(url, domain, source);
    if (result) return result;
  }

  const googleFallback = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  const result = await trySource(googleFallback, domain, 'google-fallback');
  if (result) return result;

  return null;
}
