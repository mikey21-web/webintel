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
}

export async function sidecarScrape(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
  const response = await fetch(`${config.CRAWL4AI_SIDECAR_URL}/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      waitFor: options.waitFor ?? 0,
      screenshot: options.screenshot ?? false,
      fullPage: options.fullPage ?? false,
      useJs: options.useJs ?? true,
      stealth: options.stealth ?? false,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Sidecar error ${response.status}: ${err}`);
  }

  return response.json() as Promise<ScrapeResult>;
}
