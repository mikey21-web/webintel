import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);

vi.mock('../../config', () => ({
  config: {
    PORT: 3456,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://test',
    REDIS_URL: 'redis://test',
    ANTHROPIC_API_KEY: 'test-key',
    OPENAI_API_KEY: 'test-key',
    SCOPED_JWT_SECRET: 'test-jwt-32chars-long!!',
    WEBHOOK_SECRET: 'test-wh-secret--32chars!!',
    APP_URL: 'http://localhost:3456',
    CRAWL4AI_SIDECAR_URL: 'http://localhost:8765',
    R2_BUCKET_NAME: 'test-bucket',
    R2_PUBLIC_URL: '',
    OPENAI_MODEL: 'gpt-4o',
    ANTHROPIC_MODEL: 'claude-sonnet-4-20250514',
    PROXY_PROVIDER: 'generic',
    PROXY_URL: 'http://proxy:8080',
    PROXY_USERNAME: undefined,
    PROXY_PASSWORD: undefined,
    PROXY_HOST: undefined,
    PROXY_PORT: undefined,
    CAPTCHA_PROVIDER: '2captcha',
    CAPTCHA_API_KEY: 'test-captcha-key',
    CAPTCHA_APP_ID: undefined,
  },
}));

vi.mock('../../scraping/sidecar', () => ({
  sidecarScrape: vi.fn(),
}));

import { fetchPage } from '../../fetch/tiers';
import { FetchTier } from '../../fetch/types';
import { sidecarScrape } from '../../scraping/sidecar';

const REAL_PAGE = '<html><head><title>Acme Corp</title></head><body><h1>Welcome</h1><p>Lots of real content here about our products and services. We offer competitive pricing.</p><p>Contact us at sales@acme.com for more details.</p></body></html>';

describe('tier escalation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('Tier 0 succeeds with real content — never escalates', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => REAL_PAGE,
      headers: new Map([['content-type', 'text/html']]),
    });

    const result = await fetchPage('https://example.com');

    expect(result.ok).toBe(true);
    expect(result.tier).toBe(FetchTier.T0_HTTP);
    expect(result.blockType).toBeNull();
  });

  it('escalates from T0 to T2 when HTTP returns Cloudflare challenge', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 503,
      text: async () => '<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>',
      headers: new Map([['server', 'cloudflare']]),
    });

    (sidecarScrape as any).mockResolvedValueOnce({
      markdown: REAL_PAGE,
      html: REAL_PAGE,
      metadata: { title: 'Acme' },
      source: 'playwright',
    });

    const result = await fetchPage('https://example.com');

    expect(result.ok).toBe(true);
    expect(result.tier).toBe(FetchTier.T2_HEADLESS_CHROME);
  });

  it('escalates from T0 to T2 when HTTP returns empty content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '',
      headers: new Map([['content-type', 'text/html']]),
    });

    (sidecarScrape as any).mockResolvedValueOnce({
      markdown: REAL_PAGE,
      html: REAL_PAGE,
      metadata: { title: 'Acme' },
      source: 'playwright',
    });

    const result = await fetchPage('https://example.com');

    expect(result.ok).toBe(true);
    expect(result.tier).toBe(FetchTier.T2_HEADLESS_CHROME);
  });

  it('stops at T5 when all tiers fail', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    mockFetch.mockRejectedValueOnce(new Error('Proxy error'));
    (sidecarScrape as any).mockRejectedValueOnce(new Error('Chrome crash'));
    (sidecarScrape as any).mockRejectedValueOnce(new Error('Residential timeout'));
    (sidecarScrape as any).mockRejectedValueOnce(new Error('CAPTCHA fail'));

    const result = await fetchPage('https://example.com');

    expect(result.ok).toBe(false);
    expect(result.tier).toBe(FetchTier.T5_GIVE_UP);
    expect(result.reason).toContain('All tiers exhausted');
  });

  it('render=always skips T0 and T1', async () => {
    (sidecarScrape as any).mockResolvedValueOnce({
      markdown: REAL_PAGE,
      html: REAL_PAGE,
      metadata: { title: 'Acme' },
      source: 'playwright',
    });

    const result = await fetchPage('https://example.com', { render: 'always' });

    expect(result.ok).toBe(true);
    expect(result.tier).toBe(FetchTier.T2_HEADLESS_CHROME);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('render=never stops at T1', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'short',
      headers: new Map([['content-type', 'text/html']]),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'short',
      headers: new Map([['content-type', 'text/html']]),
    });

    const result = await fetchPage('https://example.com', { render: 'never' });

    expect(result.ok).toBe(false);
    expect(result.tier).toBe(FetchTier.T5_GIVE_UP);
  });

  it('respects maxTier knob', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'error',
      headers: new Map([['content-type', 'text/html']]),
    });

    const result = await fetchPage('https://example.com', { maxTier: FetchTier.T0_HTTP } as any);

    expect(result.ok).toBe(false);
    expect(result.tier).toBe(FetchTier.T5_GIVE_UP);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('proxy provider', () => {
  it('GenericProxyProvider builds proxy URL from config', async () => {
    const { getProxyProvider } = await import('../../fetch/proxy');
    const provider = getProxyProvider();
    expect(provider).not.toBeNull();
    expect(provider!.name).toBe('generic');

    const proxy = await provider!.getProxy();
    expect(proxy.host).toBe('proxy');
    expect(proxy.port).toBe(8080);
  });
});

describe('captcha solver', () => {
  it('2Captcha solver resolves after polling', async () => {
    const { getCaptchaSolver } = await import('../../fetch/captcha');
    const solver = getCaptchaSolver();
    expect(solver).not.toBeNull();
    expect(solver!.name).toBe('2captcha');

    const health = await solver!.healthCheck();
    expect(typeof health).toBe('boolean');
  });
});
