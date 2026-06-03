import { scrapeDomain } from '../../scraping';
import { askAI } from '../../ai';

export interface CompetitorIntel {
  companyName: string;
  oneLiner: string;
  targetCustomer: string;
  productSummary: string;
  keyFeatures: string[];
  pricingTiers: { name: string; price: string; description: string }[];
  techStack: string[];
  hiringSignals: string[];
  recentContentSignals: string[];
  seoKeywords: string[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  overallScore: number;
}

export async function runCompetitorIntel(domain: string, depth: number = 1): Promise<CompetitorIntel> {
  const paths = ['/'];
  if (depth >= 2) paths.push('/pricing', '/features');
  if (depth >= 3) paths.push('/about', '/customers', '/careers');

  const pages = await scrapeDomain(domain, paths);
  const combinedText = Object.entries(pages)
    .map(([path, p]) => `--- ${path} ---\nTitle: ${p.title}\nMeta: ${p.metaDescription}\nHeadings: ${p.headings.map(h => h.text).join(', ')}\n\n${p.text.slice(0, 3000)}`)
    .join('\n\n');

  const result = await askAI<CompetitorIntel>(
    'You are a competitive intelligence analyst. Extract structured competitive intelligence from scraped website content. Return ONLY valid JSON.',
    `Analyze this website content for domain "${domain}" and provide competitive intelligence.\n\n${combinedText}\n\nReturn JSON with: companyName, oneLiner, targetCustomer, productSummary, keyFeatures (array), pricingTiers (array of {name,price,description}), techStack (array), hiringSignals (array), recentContentSignals (array), seoKeywords (array), strengths (array), weaknesses (array), opportunities (array), overallScore (number 0-100).`
  );

  return result;
}
