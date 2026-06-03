import { scrapeDomain } from '../../scraping';
import { askClaude } from '../../ai';

export interface PricingTier {
  name: string;
  price: string;
  currency: string;
  billingPeriod: string;
  included: string[];
  limits: string;
}

export interface PricingIntelResult {
  tiers: PricingTier[];
  hasFreeTrialOrFreeTier: boolean;
  pricingModel: string;
  annualDiscount: string;
  notes: string;
  lastUpdatedSignal: string;
}

export async function runPricingIntel(domain: string): Promise<PricingIntelResult> {
  const pricingPaths = ['/pricing', '/plans', '/pricing-plans', '/pricing/plans', '/subscription', '/pricing-plans'];
  const pages = await scrapeDomain(domain, pricingPaths);

  if (Object.keys(pages).length === 0) {
    const homePage = await scrapeDomain(domain, ['/']);
    const homeText = Object.values(homePage)[0]?.text || '';
    const result = await askClaude<PricingIntelResult>(
      'You are a pricing intelligence analyst. Extract pricing information from website content. Return ONLY valid JSON.',
      `No dedicated pricing page found for ${domain}. From this homepage content, extract whatever pricing info is available:\n\n${homeText.slice(0, 6000)}\n\nReturn JSON with: tiers (array of {name,price,currency,billingPeriod,included (array),limits}), hasFreeTrialOrFreeTier (boolean), pricingModel, annualDiscount, notes, lastUpdatedSignal.`
    );
    return result;
  }

  const combinedText = Object.entries(pages)
    .map(([path, p]) => `--- ${path} ---\nTitle: ${p.title}\n${p.text.slice(0, 4000)}`)
    .join('\n\n');

  const result = await askClaude<PricingIntelResult>(
    'You are a pricing intelligence analyst. Extract pricing information from website content. Return ONLY valid JSON.',
    `Extract pricing intelligence from ${domain}:\n\n${combinedText}\n\nReturn JSON with: tiers (array of {name,price,currency,billingPeriod,included (array),limits}), hasFreeTrialOrFreeTier (boolean), pricingModel, annualDiscount, notes, lastUpdatedSignal.`
  );

  return result;
}
