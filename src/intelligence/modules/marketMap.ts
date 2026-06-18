import { searchGoogle, scrapeDomain } from '../../scraping';
import { askAI } from '../../ai';

export interface CompanyProfile {
  name: string;
  description: string;
  targetSegment: string;
  estimatedSize: string;
  pricingModel: string;
  uniqueAngle: string;
}

export interface MarketMapResult {
  companies: CompanyProfile[];
  dominantPlayers: string[];
  emergingPlayers: string[];
  whitespaceGaps: string[];
}

export async function runMarketMap(keyword: string, location?: string, limit: number = 15): Promise<MarketMapResult> {
  const queries = await askAI<string[]>(
    'You are a market research analyst. Generate 3 Google search queries to find competitors in a given market. Return as a JSON array of strings.',
    `Generate 3 Google search queries to find companies in the "${keyword}" market${location ? ` in ${location}` : ''}. Return JSON array of strings.`
  );

  const allResults = new Map<string, { title: string; url: string }>();
  for (const query of queries) {
    const results = await searchGoogle(query, 10);
    for (const r of results) {
      const domain = new URL(r.url).hostname.replace('www.', '');
      if (!allResults.has(domain)) allResults.set(domain, { title: r.title, url: r.url });
    }
  }

  const domains = [...allResults.keys()].slice(0, limit);
  const companies: CompanyProfile[] = [];

  for (const domain of domains) {
    try {
      const pages = await scrapeDomain(domain, ['/']);
      const text = Object.values(pages)[0]?.text.slice(0, 4000) || '';
      const profile = await askAI<CompanyProfile>(
        'You are a market research analyst. Extract company profile information from website content. Return ONLY valid JSON.',
        `From this website content for domain "${domain}":\n\n${text}\n\nExtract: name, description, targetSegment, estimatedSize, pricingModel, uniqueAngle. Return JSON.`
      );
      companies.push(profile);
    } catch (err) {
      if (err instanceof Error) console.error(`Market map profile failed for ${domain}:`, err.message);
    }
  }

  const marketSummary = await askAI<{ dominantPlayers: string[]; emergingPlayers: string[]; whitespaceGaps: string[] }>(
    'You are a market strategy analyst. Analyze market data and identify players and gaps. Return ONLY valid JSON.',
    `Based on these companies in the "${keyword}" market:\n${JSON.stringify(companies, null, 2)}\n\nIdentify: dominantPlayers (array), emergingPlayers (array), whitespaceGaps (array of unmet needs). Return JSON.`
  );

  return { companies, ...marketSummary };
}
