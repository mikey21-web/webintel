import { config } from '../config';

export interface ScrapeResult {
  markdown: string;
  html: string;
  metadata: { title: string; description: string; ogImage?: string };
  source: 'httpx' | 'playwright' | 'curl_cffi';
  screenshotBase64?: string;
}

export interface ScrapeOptions {
  waitFor?: number;
  screenshot?: boolean;
  fullPage?: boolean;
  useJs?: boolean;
  stealth?: boolean;
  proxy?: { host: string; port: number; username?: string; password?: string };
  captchaToken?: string;
}

export interface ParseResult {
  url: string;
  markdown: string;
  documentType: 'pdf' | 'docx';
  contentType: string;
  sizeBytes: number;
  metadata: Record<string, unknown>;
}

export async function sidecarScrape(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
  const body: Record<string, unknown> = {
    url,
    waitFor: options.waitFor ?? 0,
    screenshot: options.screenshot ?? false,
    fullPage: options.fullPage ?? false,
    useJs: options.useJs ?? true,
    stealth: options.stealth ?? false,
  };

  if (options.proxy) {
    body.proxy = {
      server: `http://${options.proxy.host}:${options.proxy.port}`,
      username: options.proxy.username,
      password: options.proxy.password,
    };
  }

  if (options.captchaToken) {
    body.captchaToken = options.captchaToken;
  }

  const response = await fetch(`${config.CRAWL4AI_SIDECAR_URL}/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Sidecar error ${response.status}: ${err}`);
  }

  return response.json() as Promise<ScrapeResult>;
}

export async function sidecarParse(url: string): Promise<ParseResult> {
  const response = await fetch(`${config.CRAWL4AI_SIDECAR_URL}/parse?url=${encodeURIComponent(url)}`, {
    method: 'POST',
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Sidecar parse error ${response.status}: ${err}`);
  }

  return response.json() as Promise<ParseResult>;
}
