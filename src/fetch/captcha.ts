import { config } from '../config';
import type { CaptchaSolver, ProxyConfig } from './types';

// ---------------------------------------------------------------------------
// Error type for CAPTCHA API errors
// ---------------------------------------------------------------------------

class CaptchaError extends Error {
  constructor(
    message: string,
    public provider: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'CaptchaError';
  }
}

// ---------------------------------------------------------------------------
// 2Captcha adapter
// ---------------------------------------------------------------------------

class TwoCaptchaSolver implements CaptchaSolver {
  name = '2captcha';
  private apiKey: string;

  constructor() {
    this.apiKey = config.CAPTCHA_API_KEY || '';
  }

  private async request(params: Record<string, string>): Promise<string> {
    const formData = new URLSearchParams({ key: this.apiKey, ...params });

    const res = await fetch('https://api.2captcha.com/in.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
      signal: AbortSignal.timeout(120000),
    });

    const text = await res.text();
    if (!text.startsWith('OK|')) {
      throw new CaptchaError(`2Captcha error: ${text}`, '2captcha', res.status);
    }

    const taskId = text.split('|')[1];

    for (let i = 0; i < 60; i++) {
      await delay(3000);
      const resultRes = await fetch(
        `https://api.2captcha.com/res.php?key=${this.apiKey}&action=get&id=${taskId}`,
        { signal: AbortSignal.timeout(10000) },
      );
      const resultText = await resultRes.text();

      if (resultText === 'CAPCHA_NOT_READY') continue;
      if (!resultText.startsWith('OK|')) {
        throw new CaptchaError(`2Captcha solve failed: ${resultText}`, '2captcha');
      }
      return resultText.split('|')[1];
    }

    throw new CaptchaError('2Captcha timed out after 180s', '2captcha');
  }

  async solveRecaptchaV2(params: {
    siteKey: string;
    pageUrl: string;
    proxy?: ProxyConfig;
  }): Promise<string> {
    const requestParams: Record<string, string> = {
      method: 'userrecaptcha',
      googlekey: params.siteKey,
      pageurl: params.pageUrl,
    };

    if (params.proxy) {
      requestParams.proxytype = 'HTTP';
      requestParams.proxy = buildCaptchaProxyString(params.proxy);
    }

    return this.request(requestParams);
  }

  async solveRecaptchaV3(params: {
    siteKey: string;
    pageUrl: string;
    action?: string;
    minScore?: number;
    proxy?: ProxyConfig;
  }): Promise<string> {
    const requestParams: Record<string, string> = {
      method: 'userrecaptcha',
      version: 'v3',
      googlekey: params.siteKey,
      pageurl: params.pageUrl,
      action: params.action || 'verify',
      min_score: String(params.minScore ?? 0.3),
    };

    if (params.proxy) {
      requestParams.proxytype = 'HTTP';
      requestParams.proxy = buildCaptchaProxyString(params.proxy);
    }

    return this.request(requestParams);
  }

  async solveHCaptcha(params: {
    siteKey: string;
    pageUrl: string;
    proxy?: ProxyConfig;
  }): Promise<string> {
    const requestParams: Record<string, string> = {
      method: 'hcaptcha',
      sitekey: params.siteKey,
      pageurl: params.pageUrl,
    };

    if (params.proxy) {
      requestParams.proxytype = 'HTTP';
      requestParams.proxy = buildCaptchaProxyString(params.proxy);
    }

    return this.request(requestParams);
  }

  async reportIncorrect(taskId: string): Promise<void> {
    await fetch(
      `https://api.2captcha.com/res.php?key=${this.apiKey}&action=reportbad&id=${taskId}`,
      { signal: AbortSignal.timeout(5000) },
    );
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(
        `https://api.2captcha.com/res.php?key=${this.apiKey}&action=getbalance`,
        { signal: AbortSignal.timeout(5000) },
      );
      const text = await res.text();
      return text.startsWith('1');
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// CapSolver adapter
// ---------------------------------------------------------------------------

class CapSolverSolver implements CaptchaSolver {
  name = 'capsolver';
  private clientKey: string;
  private appId: string;

  constructor() {
    this.clientKey = config.CAPTCHA_API_KEY || '';
    this.appId = config.CAPTCHA_APP_ID || '';
  }

  private async createTask(params: Record<string, unknown>): Promise<string> {
    const res = await fetch('https://api.capsolver.com/createTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: this.clientKey,
        appId: this.appId || undefined,
        task: params,
      }),
      signal: AbortSignal.timeout(120000),
    });

    const data = (await res.json()) as { errorId: number; errorCode?: string; errorDescription?: string; taskId?: string };
    if (data.errorId !== 0 || !data.taskId) {
      throw new CaptchaError(`CapSolver error: ${data.errorDescription || data.errorCode || 'unknown'}`, 'capsolver', res.status);
    }

    for (let i = 0; i < 60; i++) {
      await delay(3000);
      const resultRes = await fetch('https://api.capsolver.com/getTaskResult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientKey: this.clientKey, taskId: data.taskId }),
        signal: AbortSignal.timeout(10000),
      });

      const resultData = (await resultRes.json()) as {
        errorId: number;
        status: string;
        solution?: { gRecaptchaResponse?: string; token?: string; captchaKey?: string };
        errorCode?: string;
        errorDescription?: string;
      };

      if (resultData.status === 'ready' && resultData.solution) {
        return resultData.solution.gRecaptchaResponse || resultData.solution.token || '';
      }
      if (resultData.errorId !== 0) {
        throw new CaptchaError(`CapSolver: ${resultData.errorDescription || resultData.errorCode}`, 'capsolver');
      }
    }

    throw new CaptchaError('CapSolver timed out after 180s', 'capsolver');
  }

  async solveRecaptchaV2(params: {
    siteKey: string;
    pageUrl: string;
    proxy?: ProxyConfig;
  }): Promise<string> {
    return this.createTask({
      type: 'ReCaptchaV2TaskProxyLess',
      websiteURL: params.pageUrl,
      websiteKey: params.siteKey,
    });
  }

  async solveRecaptchaV3(params: {
    siteKey: string;
    pageUrl: string;
    action?: string;
    minScore?: number;
    proxy?: ProxyConfig;
  }): Promise<string> {
    return this.createTask({
      type: 'ReCaptchaV3TaskProxyLess',
      websiteURL: params.pageUrl,
      websiteKey: params.siteKey,
      pageAction: params.action || 'verify',
      minScore: params.minScore ?? 0.3,
    });
  }

  async solveHCaptcha(params: {
    siteKey: string;
    pageUrl: string;
    proxy?: ProxyConfig;
  }): Promise<string> {
    return this.createTask({
      type: 'HCaptchaTaskProxyLess',
      websiteURL: params.pageUrl,
      websiteKey: params.siteKey,
    });
  }

  async reportIncorrect(_taskId: string): Promise<void> {
    // CapSolver doesn't have a report API — no-op
  }

  async healthCheck(): Promise<boolean> {
    if (!this.clientKey) return false;
    try {
      const res = await fetch('https://api.capsolver.com/getBalance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientKey: this.clientKey }),
        signal: AbortSignal.timeout(5000),
      });
      const data = (await res.json()) as { balance?: number };
      return (data.balance ?? 0) > 0;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let _solver: CaptchaSolver | null = null;

export function getCaptchaSolver(): CaptchaSolver | null {
  if (_solver) return _solver;

  const providerType = (config.CAPTCHA_PROVIDER || '').toLowerCase();

  switch (providerType) {
    case '2captcha':
      _solver = new TwoCaptchaSolver();
      break;
    case 'capsolver':
      _solver = new CapSolverSolver();
      break;
    default:
      return null;
  }

  return _solver;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCaptchaProxyString(proxy: ProxyConfig): string {
  if (proxy.username) {
    return `${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
  }
  return `${proxy.host}:${proxy.port}`;
}
