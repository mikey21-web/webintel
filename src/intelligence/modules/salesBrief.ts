import { scrapeDomain } from '../../scraping';
import { askAI } from '../../ai';

export interface SalesBriefResult {
  targetCompany: {
    name: string;
    website: string;
    industry: string;
    size: string;
    description: string;
  };
  whyTheyNeedYou: string;
  openingLine: string;
  talkingPoints: { point: string; evidence: string }[];
  objections: { objection: string; response: string }[];
  questions: string[];
  redFlags: string[];
  nextStep: string;
  estimatedDealSize: string;
  urgency: string;
}

export async function runSalesBrief(targetDomain: string, yourProduct: string, yourDomain: string): Promise<SalesBriefResult> {
  const targetPages = await scrapeDomain(targetDomain, ['/', '/about', '/pricing', '/customers', '/careers']);
  const yourPages = await scrapeDomain(yourDomain, ['/', '/pricing', '/features']);

  const targetText = Object.entries(targetPages)
    .map(([path, p]) => `--- ${path} ---\nTitle: ${p.title}\n${p.text.slice(0, 2500)}`)
    .join('\n\n');

  const yourText = Object.entries(yourPages)
    .map(([path, p]) => `--- ${path} ---\nTitle: ${p.title}\n${p.text.slice(0, 2500)}`)
    .join('\n\n');

  const result = await askAI<SalesBriefResult>(
    'You are a sales intelligence analyst. Generate a sales brief comparing a target company with your product. Return ONLY valid JSON.',
    `Generate a sales brief for targeting ${targetDomain} with our product "${yourProduct}" (${yourDomain}).\n\nTarget Company Content:\n${targetText}\n\nOur Product Content:\n${yourText}\n\nReturn JSON with: targetCompany ({name,website,industry,size,description}), whyTheyNeedYou, openingLine (specific to their site content), talkingPoints (array of {point,evidence}), objections (array of {objection,response}), questions (array), redFlags (array), nextStep, estimatedDealSize, urgency.`
  );

  return result;
}
