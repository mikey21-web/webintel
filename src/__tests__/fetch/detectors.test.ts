import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);

import { detectSoftBlock } from '../../fetch/detectors';

describe('detectSoftBlock', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns not blocked for real content', () => {
    const result = detectSoftBlock(
      '<html><head><title>Acme Corp Pricing</title></head><body><h1>Plans</h1><p>Starter $19/mo. Pro $49/mo. Enterprise $199/mo.</p><p>All plans include unlimited users, 24/7 support, and a 14-day free trial.</p></body></html>',
      200,
      { 'content-type': 'text/html' },
    );

    expect(result.blocked).toBe(false);
    expect(result.blockType).toBeNull();
  });

  it('detects Cloudflare challenge', () => {
    const html = '<html><head><title>Just a moment...</title></head><body>Checking your browser before accessing example.com. <div class="cf-browser-verification">...</div></body></html>';
    const result = detectSoftBlock(html, 503, { server: 'cloudflare' });

    expect(result.blocked).toBe(true);
    expect(result.blockType).toBe('cloudflare');
  });

  it('detects DataDome protection', () => {
    const html = '<html><head><title>Are you a robot?</title></head><body><script>var dd = {"datadome": true};</script></body></html>';
    const result = detectSoftBlock(html, 403, { 'x-datadome': 'protected' });

    expect(result.blocked).toBe(true);
    expect(result.blockType).toBe('datadome');
  });

  it('detects JS wall', () => {
    const html = '<html><body><noscript>Please enable JavaScript to view this site.</noscript></body></html>';
    const result = detectSoftBlock(html, 200, {});

    expect(result.blocked).toBe(true);
    expect(result.blockType).toBe('js_wall');
  });

  it('detects empty content', () => {
    const result = detectSoftBlock('', 200, {});

    expect(result.blocked).toBe(true);
    expect(result.blockType).toBe('empty_content');
  });

  it('detects suspiciously short content', () => {
    const result = detectSoftBlock('<html><body>hi</body></html>', 200, {});

    expect(result.blocked).toBe(true);
    expect(result.blockType).toBe('suspicious_short');
  });

  it('detects recaptcha on the page', () => {
    const html = '<html><head><title>Verify</title></head><body><div class="g-recaptcha" data-sitekey="abc123"></div><p>Please verify you are human</p></body></html>';
    const result = detectSoftBlock(html, 200, {});

    expect(result.blocked).toBe(true);
    expect(result.blockType).toBe('captcha');
  });

  it('detects Cloudflare Turnstile', () => {
    const html = '<html><head><title>Please Wait</title></head><body><div class="cf-turnstile"></div></body></html>';
    const result = detectSoftBlock(html, 200, {});

    expect(result.blocked).toBe(true);
    expect(result.blockType).toBe('cloudflare');
  });

  it('detects PerimeterX', () => {
    const html = '<html><head><title>Access Denied</title></head><body><script>window._pxAppId = "PX123";</script></body></html>';
    const result = detectSoftBlock(html, 403, { 'x-px-blocked': '1' });

    expect(result.blocked).toBe(true);
    expect(result.blockType).toBe('perimeterx');
  });

  it('detects hCaptcha', () => {
    const html = '<html><body><div class="h-captcha" data-sitekey="test"></div><p>complete the captcha</p></body></html>';
    const result = detectSoftBlock(html, 200, {});

    expect(result.blocked).toBe(true);
    expect(result.blockType).toBe('captcha');
  });

  it('detects redirect loop', () => {
    const result = detectSoftBlock(
      '<html><body>redirecting</body></html>',
      302,
      { location: 'https://example.com/' },
      'https://example.com/',
    );

    expect(result.blocked).toBe(true);
    expect(result.blockType).toBe('redirect_loop');
  });

  it('detects Akamai', () => {
    const html = '<html><body><script>bmak.verify()</script></body></html>';
    const result = detectSoftBlock(html, 403, {});

    expect(result.blocked).toBe(true);
    expect(result.blockType).toBe('akamai');
  });
});
