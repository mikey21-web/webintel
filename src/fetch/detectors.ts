import type { BlockType } from './types';

// ---------------------------------------------------------------------------
// Fingerprint signatures for known challenge platforms
// ---------------------------------------------------------------------------

interface ChallengeSignature {
  type: BlockType;
  /** Substrings to look for in HTML body */
  htmlPatterns: string[];
  /** Substrings to look for in page title */
  titlePatterns: string[];
  /** Response headers that signal a challenge */
  headerPatterns: Record<string, string>;
  /** Status codes that are suspicious */
  statusCodes: number[];
}

const SIGNATURES: ChallengeSignature[] = [
  {
    type: 'cloudflare',
    htmlPatterns: [
      'cf-challenge-form',
      '/cdn-cgi/challenge-platform',
      'cf-browser-verification',
      'Just a moment...',
      'Checking your browser',
      'cf-please-wait',
      '_cf_chl_opt',
      'jschl-answer',
      'challenge-platform/h/b',
      'cf_chl_rc_m',
      'cf-turnstile',
    ],
    titlePatterns: ['Just a moment...', 'Attention Required!', 'Please Wait'],
    headerPatterns: { 'cf-mitigated': 'challenge', server: 'cloudflare' },
    statusCodes: [403, 503],
  },
  {
    type: 'datadome',
    htmlPatterns: [
      'datadome',
      'DDOS protection',
      'geo.captcha-delivery.com',
      'datadome-client',
      'dd-bypass',
      'ddos-guard',
    ],
    titlePatterns: ['DataDome', 'Are you a robot?'],
    headerPatterns: { 'x-datadome': 'protected' },
    statusCodes: [403, 429],
  },
  {
    type: 'perimeterx',
    htmlPatterns: [
      'perimeterx',
      'px-captcha',
      '_pxCaptcha',
      '/PX',
      'px-fp',
      'window._pxAppId',
    ],
    titlePatterns: ['Access Denied', 'PerimeterX'],
    headerPatterns: { 'x-px': '', 'x-px-blocked': '1' },
    statusCodes: [403],
  },
  {
    type: 'akamai',
    htmlPatterns: [
      'akamai',
      'akamai-gtm',
      'bmak.',
      'ak_bmsc',
    ],
    titlePatterns: ['Access Denied'],
    headerPatterns: { 'x-akamai-transformed': '' },
    statusCodes: [403, 503],
  },
  {
    type: 'captcha',
    htmlPatterns: [
      'g-recaptcha',
      'recaptcha',
      'h-captcha',
      'hcaptcha',
      'cf-turnstile',
      'Are you a robot',
      'confirm you are human',
      'verify you are human',
      'complete the captcha',
    ],
    titlePatterns: ['Verify', 'Captcha', 'Robot Check'],
    headerPatterns: {},
    statusCodes: [],
  },
  {
    type: 'js_wall',
    htmlPatterns: [
      'enable JavaScript',
      'enable javascript',
      'Please enable JavaScript',
      'requires JavaScript',
      'noscript',
      'You need to enable JavaScript',
    ],
    titlePatterns: ['JavaScript required'],
    headerPatterns: {},
    statusCodes: [],
  },
];

// ---------------------------------------------------------------------------
// Content quality heuristics
// ---------------------------------------------------------------------------

const MIN_CONTENT_LENGTH = 100;
const MIN_TEXT_DENSITY = 0.02;

function textContent(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DetectionResult {
  blocked: boolean;
  blockType: BlockType | null;
  reason: string | null;
  confidence: number; // 0-1
}

/**
 * Analyze an HTTP response to determine if it's a real page or a soft-block.
 * Checks content length, text density, known challenge patterns, headers, and status codes.
 */
export function detectSoftBlock(
  html: string,
  statusCode: number,
  headers: Record<string, string> = {},
  url?: string,
): DetectionResult {
  const title = extractTitle(html);
  const text = textContent(html);
  const textLen = text.length;

  // 1. Check known challenge signatures (lower threshold since challenge pages are short)
  for (const sig of SIGNATURES) {
    let matches = 0;
    let possible = 0;

    for (const pat of sig.htmlPatterns) {
      possible++;
      if (html.toLowerCase().includes(pat.toLowerCase())) matches++;
    }

    for (const pat of sig.titlePatterns) {
      possible++;
      if (title.toLowerCase().includes(pat.toLowerCase())) matches++;
    }

    for (const [header, value] of Object.entries(sig.headerPatterns)) {
      possible++;
      const headerVal = (headers[header.toLowerCase()] || headers[header] || '').toLowerCase();
      if (value ? headerVal.includes(value.toLowerCase()) : headerVal !== '') matches++;
    }

    if (sig.statusCodes.includes(statusCode)) {
      possible++;
      matches++;
    }

    // Two thresholds: high-confidence (≥40% match) OR minimum 2 signal matches on very short pages
    const matchRatio = possible > 0 ? matches / possible : 0;
    if (matches >= 2 && matchRatio >= 0.1) {
      return {
        blocked: true,
        blockType: sig.type,
        reason: `Detected ${sig.type} — ${matches}/${possible} signature matches (${(matchRatio * 100).toFixed(0)}%)`,
        confidence: Math.min(1, matchRatio * 2),
      };
    }
  }

  // 2. Redirect loop detection (before content length check)
  if (url && headers['location']) {
    const location = headers['location'];
    if (location === url || location === '/' || location === url + '/') {
      return {
        blocked: true,
        blockType: 'redirect_loop',
        reason: `Redirect loop detected: ${location}`,
        confidence: 0.9,
      };
    }
  }

  // 3. Empty content
  if (textLen === 0) {
    return { blocked: true, blockType: 'empty_content', reason: 'Response body is empty', confidence: 1.0 };
  }

  // 4. Short content — only flag if no signature was matched
  if (textLen < MIN_CONTENT_LENGTH) {
    return {
      blocked: true,
      blockType: 'suspicious_short',
      reason: `Response too short (${textLen} chars)`,
      confidence: 0.8,
    };
  }

  // 5. Text density check
  const density = textLen / Math.max(html.length, 1);
  if (density < MIN_TEXT_DENSITY) {
    return {
      blocked: true,
      blockType: 'suspicious_short',
      reason: `Very low text density (${(density * 100).toFixed(1)}%)`,
      confidence: 0.6,
    };
  }

  // 6. 200-OK but the title is a dead giveaway
  const lowContentTitles = ['just a moment', 'attention required', 'access denied', '403 forbidden', '502 bad gateway'];
  if (lowContentTitles.some((t) => title.toLowerCase().includes(t))) {
    return {
      blocked: true,
      blockType: 'unknown_challenge',
      reason: `Suspicious title: "${title}" with OK status`,
      confidence: 0.7,
    };
  }

  // 7. Unusual status codes for real pages
  if (statusCode >= 400 && statusCode < 500) {
    return {
      blocked: true,
      blockType: 'unknown_challenge',
      reason: `HTTP ${statusCode}`,
      confidence: 0.5,
    };
  }

  return { blocked: false, blockType: null, reason: null, confidence: 1.0 };
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : '';
}
