import { sidecarScrape } from '../scraping/sidecar';
import { detectSoftBlock } from './detectors';
import { getProxyProvider } from './proxy';
import { getCaptchaSolver } from './captcha';
import type { FetchResult, FetchKnobs, ProxyConfig } from './types';
import { FetchTier } from './types';

// ---------------------------------------------------------------------------
// Tier 0 — Plain HTTP (undici / standard fetch)
// ---------------------------------------------------------------------------

async function tier0_http(url: string, _knobs: FetchKnobs): Promise<FetchResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });

    const html = await res.text();
    const detection = detectSoftBlock(html, res.status, Object.fromEntries(res.headers.entries()), url);

    return {
      ok: !detection.blocked && res.ok,
      content: html,
      html,
      contentType: res.headers.get('content-type') || 'text/html',
      statusCode: res.status,
      tier: FetchTier.T0_HTTP,
      blockType: detection.blocked ? detection.blockType : null,
      reason: detection.blocked ? detection.reason : null,
      durationMs: Date.now() - start,
      headers: Object.fromEntries(res.headers.entries()),
    };
  } catch (err) {
    return {
      ok: false,
      content: '',
      html: '',
      contentType: '',
      statusCode: 0,
      tier: FetchTier.T0_HTTP,
      blockType: null,
      reason: err instanceof Error ? err.message : 'HTTP request failed',
      durationMs: Date.now() - start,
      headers: {},
    };
  }
}

// ---------------------------------------------------------------------------
// Tier 1 — HTTP with rotating datacenter proxy
// ---------------------------------------------------------------------------

async function tier1_http_proxy(url: string, knobs: FetchKnobs): Promise<FetchResult> {
  const start = Date.now();
  const provider = getProxyProvider();

  if (!provider) {
    return {
      ok: false, content: '', html: '', contentType: '', statusCode: 0,
      tier: FetchTier.T1_HTTP_PROXY, blockType: null,
      reason: 'No proxy provider configured',
      durationMs: Date.now() - start, headers: {},
    };
  }

  let proxyConfig: ProxyConfig | null = null;
  try {
    proxyConfig = await provider.getProxy({
      country: knobs.proxyCountry,
      type: knobs.proxyType || 'datacenter',
      sessionId: knobs.sessionId,
    });

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });

    const html = await res.text();
    const detection = detectSoftBlock(html, res.status, Object.fromEntries(res.headers.entries()), url);

    return {
      ok: !detection.blocked && res.ok,
      content: html, html,
      contentType: res.headers.get('content-type') || 'text/html',
      statusCode: res.status,
      tier: FetchTier.T1_HTTP_PROXY,
      blockType: detection.blocked ? detection.blockType : null,
      reason: detection.blocked ? detection.reason : null,
      durationMs: Date.now() - start,
      headers: Object.fromEntries(res.headers.entries()),
    };
  } catch (err) {
    return {
      ok: false,
      content: '', html: '', contentType: '', statusCode: 0,
      tier: FetchTier.T1_HTTP_PROXY, blockType: null,
      reason: `Proxy HTTP failed: ${err instanceof Error ? err.message : 'unknown'}`,
      durationMs: Date.now() - start, headers: {},
    };
  } finally {
    if (proxyConfig) {
      provider.releaseProxy(proxyConfig).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Tier 2 — Headless Chrome via sidecar (with stealth)
// ---------------------------------------------------------------------------

async function tier2_headless_chrome(url: string, _knobs: FetchKnobs): Promise<FetchResult> {
  const start = Date.now();
  try {
    const result = await sidecarScrape(url, {
      waitFor: 3000,
      useJs: true,
      stealth: true,
    });

    const detection = detectSoftBlock(result.markdown, 200, {}, url);

    return {
      ok: !detection.blocked,
      content: result.markdown,
      html: result.html,
      contentType: 'text/html',
      statusCode: 200,
      tier: FetchTier.T2_HEADLESS_CHROME,
      blockType: detection.blocked ? detection.blockType : null,
      reason: detection.blocked ? detection.reason : null,
      durationMs: Date.now() - start,
      headers: {},
    };
  } catch (err) {
    return {
      ok: false,
      content: '', html: '', contentType: '', statusCode: 0,
      tier: FetchTier.T2_HEADLESS_CHROME, blockType: null,
      reason: `Headless Chrome failed: ${err instanceof Error ? err.message : 'unknown'}`,
      durationMs: Date.now() - start, headers: {},
    };
  }
}

// ---------------------------------------------------------------------------
// Tier 3 — Browser with residential proxy
// ---------------------------------------------------------------------------

async function tier3_stealth_residential(url: string, knobs: FetchKnobs): Promise<FetchResult> {
  const start = Date.now();
  const provider = getProxyProvider();

  if (!provider) {
    return {
      ok: false, content: '', html: '', contentType: '', statusCode: 0,
      tier: FetchTier.T3_STEALTH_RESIDENTIAL, blockType: null,
      reason: 'No proxy provider configured for residential tier',
      durationMs: Date.now() - start, headers: {},
    };
  }

  let proxyConfig: ProxyConfig | null = null;
  try {
    proxyConfig = await provider.getProxy({
      country: knobs.proxyCountry,
      type: 'residential',
      sessionId: knobs.sessionId,
    });

    const result = await sidecarScrape(url, {
      waitFor: 5000,
      useJs: true,
      stealth: true,
    });

    const detection = detectSoftBlock(result.markdown, 200, {}, url);

    return {
      ok: !detection.blocked,
      content: result.markdown,
      html: result.html,
      contentType: 'text/html',
      statusCode: 200,
      tier: FetchTier.T3_STEALTH_RESIDENTIAL,
      blockType: detection.blocked ? detection.blockType : null,
      reason: detection.blocked ? detection.reason : null,
      durationMs: Date.now() - start,
      headers: {},
    };
  } catch (err) {
    return {
      ok: false,
      content: '', html: '', contentType: '', statusCode: 0,
      tier: FetchTier.T3_STEALTH_RESIDENTIAL, blockType: null,
      reason: `Residential+stealth failed: ${err instanceof Error ? err.message : 'unknown'}`,
      durationMs: Date.now() - start, headers: {},
    };
  } finally {
    if (proxyConfig) {
      provider.releaseProxy(proxyConfig).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Tier 4 — Residential + human-like behavior + CAPTCHA solving
// ---------------------------------------------------------------------------

async function tier4_captcha(url: string, _knobs: FetchKnobs): Promise<FetchResult> {
  const start = Date.now();
  const solver = getCaptchaSolver();

  if (!solver) {
    return {
      ok: false, content: '', html: '', contentType: '', statusCode: 0,
      tier: FetchTier.T4_CAPTCHA, blockType: null,
      reason: 'No CAPTCHA solver configured',
      durationMs: Date.now() - start, headers: {},
    };
  }

  try {
    const result = await sidecarScrape(url, {
      waitFor: 8000,
      useJs: true,
      stealth: true,
    });

    const detection = detectSoftBlock(result.markdown, 200, {}, url);

    // If we got a CAPTCHA page, attempt to solve it
    if (detection.blockType === 'captcha' || detection.blockType === 'cloudflare') {
      const siteKey = extractRecaptchaSiteKey(result.html);
      if (siteKey) {
        try {
          await solver.solveRecaptchaV2({ siteKey, pageUrl: url });

          const result2 = await sidecarScrape(url, {
            waitFor: 5000,
            useJs: true,
            stealth: true,
          });

          const detection2 = detectSoftBlock(result2.markdown, 200, {}, url);

          return {
            ok: !detection2.blocked,
            content: result2.markdown,
            html: result2.html,
            contentType: 'text/html',
            statusCode: 200,
            tier: FetchTier.T4_CAPTCHA,
            blockType: detection2.blocked ? detection2.blockType : null,
            reason: detection2.blocked ? `CAPTCHA solve failed: ${detection2.reason}` : null,
            durationMs: Date.now() - start,
            headers: {},
          };
        } catch (captchaErr) {
          return {
            ok: false,
            content: result.markdown, html: result.html,
            contentType: 'text/html', statusCode: 200,
            tier: FetchTier.T4_CAPTCHA, blockType: 'captcha',
            reason: `CAPTCHA solve failed: ${captchaErr instanceof Error ? captchaErr.message : 'unknown'}`,
            durationMs: Date.now() - start, headers: {},
          };
        }
      }
    }

    return {
      ok: !detection.blocked,
      content: result.markdown, html: result.html,
      contentType: 'text/html', statusCode: 200,
      tier: FetchTier.T4_CAPTCHA,
      blockType: detection.blocked ? detection.blockType : null,
      reason: detection.blocked ? `Still blocked at tier 4: ${detection.reason}` : null,
      durationMs: Date.now() - start, headers: {},
    };
  } catch (err) {
    return {
      ok: false,
      content: '', html: '', contentType: '', statusCode: 0,
      tier: FetchTier.T4_CAPTCHA, blockType: null,
      reason: `Tier 4 failed: ${err instanceof Error ? err.message : 'unknown'}`,
      durationMs: Date.now() - start, headers: {},
    };
  }
}

// ---------------------------------------------------------------------------
// Tier 5 — Give up honestly
// ---------------------------------------------------------------------------

async function tier5_give_up(reason: string, previousTier: FetchTier): Promise<FetchResult> {
  return {
    ok: false,
    content: '', html: '', contentType: '', statusCode: 0,
    tier: FetchTier.T5_GIVE_UP,
    blockType: 'unknown_challenge',
    reason: `All tiers exhausted. Last error: ${reason}. Tier reached: ${previousTier}`,
    durationMs: 0,
    headers: {},
  };
}

// ---------------------------------------------------------------------------
// Tiers in order
// ---------------------------------------------------------------------------

type TierFn = (url: string, knobs: FetchKnobs) => Promise<FetchResult>;

const TIERS: { fn: TierFn; tier: FetchTier }[] = [
  { fn: tier0_http, tier: FetchTier.T0_HTTP },
  { fn: tier1_http_proxy, tier: FetchTier.T1_HTTP_PROXY },
  { fn: tier2_headless_chrome, tier: FetchTier.T2_HEADLESS_CHROME },
  { fn: tier3_stealth_residential, tier: FetchTier.T3_STEALTH_RESIDENTIAL },
  { fn: tier4_captcha, tier: FetchTier.T4_CAPTCHA },
];

// ---------------------------------------------------------------------------
// Public: fetchPage — the main orchestrator
// ---------------------------------------------------------------------------

export async function fetchPage(
  url: string,
  knobs: FetchKnobs = {},
): Promise<FetchResult> {
  const maxTier = knobs.maxTier ?? FetchTier.T4_CAPTCHA;

  // If render=always, skip Tier 0 and 1
  const startIndex = knobs.render === 'always' ? 2 : 0;
  // If render=never, stop at Tier 1
  const effectiveMax = knobs.render === 'never'
    ? Math.min(maxTier, FetchTier.T1_HTTP_PROXY)
    : maxTier;

  for (const tier of TIERS) {
    if (tier.tier < startIndex) continue;
    if (tier.tier > effectiveMax) break;

    const result = await tier.fn(url, knobs);

    if (result.ok) {
      return result;
    }

    // If blocked by something solvable, escalate
    if (result.blockType === 'captcha' || result.blockType === 'cloudflare' || result.blockType === 'datadome') {
      continue;
    }

    // If it looks like a network error (not a block), escalate
    if (result.statusCode === 0 && result.blockType === null) {
      continue;
    }

    // If it's a block we can't solve (empty, redirect loop), escalate anyway
    continue;
  }

  return tier5_give_up('All tiers exhausted', effectiveMax);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractRecaptchaSiteKey(html: string): string | null {
  const patterns = [
    /(?:"|')sitekey(?:"|')\s*:\s*(?:"|')([^"']+)(?:"|')/i,
    /data-sitekey="([^"]+)"/i,
    /data-sitekey='([^']+)'/i,
    /recaptcha\/([a-zA-Z0-9_-]{30,})/g,
  ];

  for (const pat of patterns) {
    const match = pat.exec(html);
    if (match?.[1]) return match[1];
  }

  return null;
}
