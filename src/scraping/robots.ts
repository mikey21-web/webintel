import { config } from '../config';

interface RobotsRule {
  allow: string[];
  disallow: string[];
  crawlDelay: number;
}

const robotsCache = new Map<string, { rules: RobotsRule; fetchedAt: number }>();
const CACHE_TTL = 3600000; // 1 hour

async function fetchRobotsTxt(domain: string): Promise<string> {
  try {
    const res = await fetch(`https://${domain}/robots.txt`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return res.text();
  } catch { /* ignore fetch errors */ }
  return '';
}

function parseRobotsTxt(content: string, userAgent = 'WebIntel/1.0'): RobotsRule {
  const rules: RobotsRule = { allow: [], disallow: [], crawlDelay: 0 };
  let currentAgent = '*';

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.toLowerCase().startsWith('user-agent:')) {
      currentAgent = trimmed.split(':')[1]?.trim() || '*';
      continue;
    }

    // Only parse rules for our agent or wildcard
    if (currentAgent !== '*' && currentAgent !== userAgent) continue;

    if (trimmed.toLowerCase().startsWith('disallow:')) {
      const path = trimmed.split(':').slice(1).join(':').trim();
      if (path) rules.disallow.push(path);
    }

    if (trimmed.toLowerCase().startsWith('allow:')) {
      const path = trimmed.split(':').slice(1).join(':').trim();
      if (path) rules.allow.push(path);
    }

    if (trimmed.toLowerCase().startsWith('crawl-delay:')) {
      const delay = parseInt(trimmed.split(':')[1]?.trim() || '0', 10);
      if (!isNaN(delay)) rules.crawlDelay = delay;
    }
  }

  return rules;
}

function isPathAllowed(path: string, rules: RobotsRule): boolean {
  // Check explicit allows first (higher priority)
  for (const allowed of rules.allow) {
    if (path.startsWith(allowed) || matchWildcard(path, allowed)) return true;
  }

  // Check disallows
  for (const disallowed of rules.disallow) {
    if (path.startsWith(disallowed) || matchWildcard(path, disallowed)) return false;
  }

  // Default: allow if no matching disallow
  return true;
}

function matchWildcard(path: string, pattern: string): boolean {
  // Basic wildcard matching: * matches anything
  if (!pattern.includes('*')) return path === pattern;
  const parts = pattern.split('*');
  if (parts.length === 2) return path.startsWith(parts[0]) && path.endsWith(parts[1]);
  return true; // simplified: complex patterns return allowed
}

export interface RobotsCheckResult {
  allowed: boolean;
  url: string;
  domain: string;
  path: string;
  reason: string;
  crawlDelay: number;
  hasRobotsTxt: boolean;
}

export async function checkRobotsTxt(url: string): Promise<RobotsCheckResult> {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname;
    const path = parsed.pathname + parsed.search;

    // Check cache
    const cached = robotsCache.get(domain);
    if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL) {
      const allowed = isPathAllowed(path, cached.rules);
      return {
        allowed,
        url,
        domain,
        path,
        reason: allowed ? 'Allowed by robots.txt' : `Blocked by robots.txt (disallowed pattern)`,
        crawlDelay: cached.rules.crawlDelay,
        hasRobotsTxt: true,
      };
    }

    const content = await fetchRobotsTxt(domain);
    
    if (!content) {
      // No robots.txt — assume allowed
      return {
        allowed: true,
        url,
        domain,
        path,
        reason: 'No robots.txt found — allowed by default',
        crawlDelay: 0,
        hasRobotsTxt: false,
      };
    }

    const rules = parseRobotsTxt(content);
    robotsCache.set(domain, { rules, fetchedAt: Date.now() });

    const allowed = isPathAllowed(path, rules);
    return {
      allowed,
      url,
      domain,
      path,
      reason: allowed ? 'Allowed by robots.txt' : `Blocked by robots.txt (disallowed pattern)`,
      crawlDelay: rules.crawlDelay,
      hasRobotsTxt: true,
    };
  } catch {
    return {
      allowed: true,
      url,
      domain: '',
      path: '',
      reason: 'Error checking robots.txt — allowed by default',
      crawlDelay: 0,
      hasRobotsTxt: false,
    };
  }
}

export function clearRobotsCache(): void {
  robotsCache.clear();
}
