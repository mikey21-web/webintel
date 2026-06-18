import { config } from '../config';
import type { ProxyProvider, ProxyConfig } from './types';

// ---------------------------------------------------------------------------
// IPRoyal adapter
// ---------------------------------------------------------------------------

class IPRoyalProvider implements ProxyProvider {
  name = 'iproyal';

  async getProxy(options?: {
    country?: string;
    type?: 'datacenter' | 'residential';
    sessionId?: string;
  }): Promise<ProxyConfig> {
    const username = config.PROXY_USERNAME || '';
    const password = config.PROXY_PASSWORD || '';

    const host = config.PROXY_HOST || 'geo.iproyal.com';
    const port = config.PROXY_PORT ? Number(config.PROXY_PORT) : 12321;

    const country = options?.country?.toLowerCase();
    const sessionId = options?.sessionId ? `_${options.sessionId}` : '';

    if (country) {
      const baseUsername = username.includes('_country') ? username.split('_country')[0] : username;
      const fullUsername = `${baseUsername}_country-${country}${sessionId}`;

      return {
        host,
        port,
        username: fullUsername,
        password,
        type: options?.type || 'residential',
        country: options?.country,
      };
    }

    return {
      host,
      port,
      username: username + sessionId,
      password,
      type: options?.type || 'residential',
      country: options?.country,
    };
  }

  async releaseProxy(_config: ProxyConfig): Promise<void> {}

  async healthCheck(): Promise<boolean> {
    if (!config.PROXY_USERNAME || !config.PROXY_PASSWORD) return false;
    try {
      const res = await fetch('https://httpbin.org/ip', {
        headers: { 'Proxy-Authorization': `Basic ${Buffer.from(`${config.PROXY_USERNAME}:${config.PROXY_PASSWORD}`).toString('base64')}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// BrightData adapter
// ---------------------------------------------------------------------------

class BrightDataProvider implements ProxyProvider {
  name = 'brightdata';

  async getProxy(options?: {
    country?: string;
    type?: 'datacenter' | 'residential';
    sessionId?: string;
  }): Promise<ProxyConfig> {
    const username = config.PROXY_USERNAME || '';
    const password = config.PROXY_PASSWORD || '';

    const zone = options?.type === 'datacenter' ? 'dc' : 'residential';
    const countrySuffix = options?.country ? `-country-${options?.country.toLowerCase()}` : '';
    const sessionSuffix = options?.sessionId ? `-session-${options.sessionId}` : '';

    return {
      host: config.PROXY_HOST || 'brd.superproxy.io',
      port: config.PROXY_PORT ? Number(config.PROXY_PORT) : 33335,
      username: `${username}-zone-${zone}${countrySuffix}${sessionSuffix}`,
      password,
      type: options?.type || 'residential',
      country: options?.country,
    };
  }

  async releaseProxy(_config: ProxyConfig): Promise<void> {}

  async healthCheck(): Promise<boolean> {
    if (!config.PROXY_USERNAME || !config.PROXY_PASSWORD) return false;
    try {
      const res = await fetch('https://lumtest.com/myip.json', {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Generic HTTP proxy adapter (any standard HTTP proxy by URL)
// ---------------------------------------------------------------------------

class GenericProxyProvider implements ProxyProvider {
  name = 'generic';

  async getProxy(options?: {
    country?: string;
    type?: 'datacenter' | 'residential';
    sessionId?: string;
  }): Promise<ProxyConfig> {
    const proxyUrl = config.PROXY_URL;
    if (!proxyUrl) throw new Error('PROXY_URL not configured');

    const parsed = new URL(proxyUrl);
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80),
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      type: options?.type || 'datacenter',
      country: options?.country,
    };
  }

  async releaseProxy(_config: ProxyConfig): Promise<void> {}

  async healthCheck(): Promise<boolean> {
    return !!config.PROXY_URL;
  }
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

let _provider: ProxyProvider | null = null;

export function getProxyProvider(): ProxyProvider | null {
  if (_provider) return _provider;

  const providerType = (config.PROXY_PROVIDER || 'generic').toLowerCase();

  switch (providerType) {
    case 'iproyal':
      _provider = new IPRoyalProvider();
      break;
    case 'brightdata':
    case 'bright_data':
    case 'bright-data':
      _provider = new BrightDataProvider();
      break;
    default:
      _provider = new GenericProxyProvider();
  }

  return _provider;
}

export function buildProxyUrl(config: ProxyConfig): string {
  const auth = config.username
    ? `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password || '')}@`
    : '';
  return `http://${auth}${config.host}:${config.port}`;
}
