// ---------------------------------------------------------------------------
// Tiered Fetch / Unblock Engine Types
// ---------------------------------------------------------------------------

/** Fetch tiers: cheap → expensive, escalate ONLY on failure or soft-block */
export enum FetchTier {
  T0_HTTP = 0,
  T1_HTTP_PROXY = 1,
  T2_HEADLESS_CHROME = 2,
  T3_STEALTH_RESIDENTIAL = 3,
  T4_CAPTCHA = 4,
  T5_GIVE_UP = 5,
}

/** High-level result of a page fetch, regardless of tier */
export interface FetchResult {
  /** Whether real content was successfully retrieved */
  ok: boolean;
  /** The page content (markdown, html, text) */
  content: string;
  /** Raw HTML from the page */
  html: string;
  /** Content type of the response */
  contentType: string;
  /** HTTP status code */
  statusCode: number;
  /** Which tier produced this result */
  tier: FetchTier;
  /** If not ok, the classification of why */
  blockType: BlockType | null;
  /** Human-readable reason for failure */
  reason: string | null;
  /** Time taken in ms */
  durationMs: number;
  /** Response headers */
  headers: Record<string, string>;
}

/** Soft-block classifications */
export type BlockType =
  | 'cloudflare'
  | 'datadome'
  | 'perimeterx'
  | 'akamai'
  | 'captcha'
  | 'js_wall'
  | 'empty_content'
  | 'suspicious_short'
  | 'redirect_loop'
  | 'unknown_challenge';

/** Proxy configuration */
export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  type: 'datacenter' | 'residential' | 'isp';
  country?: string;
}

/** Proxy provider interface — add new providers by implementing this */
export interface ProxyProvider {
  name: string;
  getProxy(options?: { country?: string; type?: 'datacenter' | 'residential'; sessionId?: string }): Promise<ProxyConfig>;
  releaseProxy(config: ProxyConfig): Promise<void>;
  healthCheck(): Promise<boolean>;
}

/** CAPTCHA solver interface */
export interface CaptchaSolver {
  name: string;
  solveRecaptchaV2(params: { siteKey: string; pageUrl: string; proxy?: ProxyConfig }): Promise<string>;
  solveRecaptchaV3(params: { siteKey: string; pageUrl: string; action?: string; minScore?: number; proxy?: ProxyConfig }): Promise<string>;
  solveHCaptcha(params: { siteKey: string; pageUrl: string; proxy?: ProxyConfig }): Promise<string>;
  reportIncorrect(taskId: string): Promise<void>;
  healthCheck(): Promise<boolean>;
}

/** User-configurable knobs exposed on scrape/extract endpoints */
export interface FetchKnobs {
  /** Force use of a specific proxy country */
  proxyCountry?: string;
  /** Prefer residential vs datacenter */
  proxyType?: 'residential' | 'datacenter';
  /** Keep the same IP across requests */
  sessionId?: string;
  /** Force JS rendering: never skip browser tier */
  render?: 'auto' | 'always' | 'never';
  /** Actions to perform on the page (click, scroll, etc.) */
  actions?: PageAction[];
  /** Maximum tier to escalate to (1-4) */
  maxTier?: FetchTier;
  /** Ignore robots.txt */
  ignoreRobots?: boolean;
}

/** Browser-level action to perform */
export type PageAction =
  | { type: 'click'; selector: string }
  | { type: 'scroll'; distance?: number }
  | { type: 'wait_for_selector'; selector: string; timeoutMs?: number }
  | { type: 'wait_for_network_idle'; timeoutMs?: number }
  | { type: 'dismiss_modal'; selector?: string }
  | { type: 'expand'; selector: string };
