import { fetch } from 'undici';

export class WebIntel {
  private baseUrl: string;
  private apiKey: string;

  constructor(options: { apiKey: string; baseUrl?: string }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'https://api.webintel.dev';
  }

  private async _request(method: string, path: string, body?: any): Promise<any> {
    const retryable = [429, 502, 503];
    const delays = [1000, 2000, 4000];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'webintel-typescript-sdk/0.1.0',
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok && retryable.includes(res.status) && attempt < 2) {
          await new Promise(r => setTimeout(r, delays[attempt]));
          continue;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        return res.json();
      } catch (e) {
        if (attempt < 2 && (e instanceof TypeError || (e as Error)?.name === 'AbortError')) {
          await new Promise(r => setTimeout(r, delays[attempt]));
          continue;
        }
        throw e;
      }
    }
  }

  // Scrape a URL to markdown
  async scrape(url: string, options?: { useJs?: boolean; waitFor?: number }): Promise<any> {
    return this._request('POST', '/v1/web/scrape/markdown', { url, ...options });
  }

  // Scrape to HTML
  async scrapeHtml(url: string): Promise<any> {
    return this._request('POST', '/v1/web/scrape/html', { url });
  }

  // Extract structured data using AI + JSON Schema
  async extract(url: string, schema?: Record<string, any>, prompt?: string): Promise<any> {
    return this._request('POST', '/v1/web/extract', { url, schema, prompt });
  }

  // Crawl a domain
  async crawl(url: string, options?: { maxPages?: number; webhookUrl?: string }): Promise<any> {
    return this._request('POST', '/v1/web/crawl', { url, ...options });
  }

  // Get crawl job status
  async getCrawlJob(jobId: string): Promise<any> {
    return this._request('GET', `/v1/web/crawl/${jobId}`);
  }

  // Search the web
  async search(query: string, numResults?: number): Promise<any> {
    return this._request('POST', '/v1/web/search', { query, numResults });
  }

  // Ask a question about a page
  async query(url: string, question: string): Promise<any> {
    return this._request('POST', '/v1/web/query', { url, question });
  }

  // Get brand profile
  async brandProfile(domain: string): Promise<any> {
    return this._request('GET', `/v1/brand/profile?domain=${domain}`);
  }

  // Get brand logo
  async brandLogo(domain: string): Promise<any> {
    return this._request('GET', `/v1/brand/logo?domain=${domain}`);
  }

  // Get brand colors
  async brandColors(domain: string): Promise<any> {
    return this._request('GET', `/v1/brand/colors?domain=${domain}`);
  }

  // Get brand fonts
  async brandFonts(domain: string): Promise<any> {
    return this._request('GET', `/v1/brand/fonts?domain=${domain}`);
  }

  // Get brand socials
  async brandSocials(domain: string): Promise<any> {
    return this._request('GET', `/v1/brand/socials?domain=${domain}`);
  }

  // Get brand tech stack
  async brandTechStack(domain: string): Promise<any> {
    return this._request('GET', `/v1/brand/techstack?domain=${domain}`);
  }

  // Get brand styleguide
  async brandStyleguide(domain: string): Promise<any> {
    return this._request('GET', `/v1/brand/styleguide?domain=${domain}`);
  }

  // Get brand address
  async brandAddress(domain: string): Promise<any> {
    return this._request('GET', `/v1/brand/address?domain=${domain}`);
  }

  // Classify a business (NAICS/SIC/EIC)
  async classify(domain: string): Promise<any> {
    return this._request('GET', `/v1/brand/classify?domain=${domain}`);
  }

  // Get logo CDN URL (no API key needed)
  logoUrl(domain: string): string {
    return `https://cdn.webintel.dev/logo/${domain}.png`;
  }

  // Check health
  async health(): Promise<any> {
    return this._request('GET', '/health');
  }
}
