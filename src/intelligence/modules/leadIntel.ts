import { scrapeDomain } from '../../scraping';
import { askClaude } from '../../ai';

export interface BuyingSignal {
  strength: 'high' | 'medium' | 'low';
  reason: string;
}

export interface LeadIntelResult {
  companyName: string;
  industry: string;
  estimatedSize: string;
  estimatedRevenue: string;
  techStack: string[];
  currentSolutions: string[];
  painPoints: string[];
  buyingSignals: BuyingSignal[];
  redFlags: string[];
  decisionMakers: string[];
  outreachAngle: string;
  score: number;
  scoreReason: string;
}

export async function runLeadIntel(domains: string[], context?: string): Promise<LeadIntelResult[]> {
  const results: LeadIntelResult[] = [];
  for (const domain of domains) {
    try {
      const pages = await scrapeDomain(domain, ['/', '/about', '/team', '/contact', '/careers']);
      const combinedText = Object.entries(pages)
        .map(([path, p]) => `--- ${path} ---\nTitle: ${p.title}\n${p.text.slice(0, 2000)}`)
        .join('\n\n');

      const result = await askClaude<LeadIntelResult>(
        'You are a lead intelligence analyst. Extract structured lead intelligence from company website content. Return ONLY valid JSON.',
        `Analyze this company website for domain "${domain}" and provide lead intelligence.\n${context ? `\nContext: ${context}\n` : ''}\n\nContent:\n${combinedText}\n\nReturn JSON with: companyName, industry, estimatedSize, estimatedRevenue, techStack (array), currentSolutions (array), painPoints (array), buyingSignals (array of {strength, reason}), redFlags (array), decisionMakers (array), outreachAngle, score (0-100), scoreReason.`
      );
      results.push(result);
    } catch { /* skip failed */ }
  }
  return results;
}
