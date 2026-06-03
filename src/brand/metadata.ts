import * as cheerio from 'cheerio';
import SemanticImportance from '@anthropic-ai/sdk';
import { config } from '../config';

interface MetadataResult {
  brandName: string | null;
  description: string | null;
  socials: Record<string, string | null>;
  gstin: string | null;
  pincode: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  employeeCount: number | null;
  foundedYear: number | null;
}

const claude = new SemanticImportance({ apiKey: config.ANTHROPIC_API_KEY });

const SOCIAL_DOMAINS: Record<string, RegExp[]> = {
  twitter: [/twitter\.com/, /x\.com/],
  linkedin: [/linkedin\.com/],
  instagram: [/instagram\.com/],
  facebook: [/facebook\.com/, /fb\.com/],
  youtube: [/youtube\.com/, /youtu\.be/],
  whatsapp: [/wa\.me/, /whatsapp\.com/],
};

const GST_REGEX = /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}\b/;
const PINCODE_REGEX = /\b\d{6}\b/;

function extractSocials($: cheerio.CheerioAPI): Record<string, string | null> {
  const socials: Record<string, string | null> = {
    twitter: null, linkedin: null, instagram: null,
    facebook: null, youtube: null, whatsapp: null,
  };

  $('a[href]').each((_: number, el: any) => {
    const href = $(el).attr('href') || '';
    for (const [key, patterns] of Object.entries(SOCIAL_DOMAINS)) {
      if (socials[key]) continue;
      if (patterns.some(p => p.test(href))) {
        socials[key] = href;
      }
    }
  });

  return socials;
}

async function extractBusinessInfo(domain: string, text: string): Promise<{
  brandName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  employeeCount: number | null;
  foundedYear: number | null;
}> {
  try {
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Extract business information from this website content for "${domain}".

Return ONLY a JSON object (no markdown, no code fences) with these fields:
- brandName: the business/brand name
- address: full street address if found
- city: city name
- state: state/province name
- employeeCount: number of employees (as number, or null)
- foundedYear: founding year (as number, or null)

Use null for any field you cannot determine.

Website content:
${text.slice(0, 4000)}`,
      }],
    });

    const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(content.replace(/```json\s*/gi, '').replace(/```/g, '').trim());
    return {
      brandName: parsed.brandName || null,
      address: parsed.address || null,
      city: parsed.city || null,
      state: parsed.state || null,
      employeeCount: typeof parsed.employeeCount === 'number' ? parsed.employeeCount : null,
      foundedYear: typeof parsed.foundedYear === 'number' ? parsed.foundedYear : null,
    };
  } catch {
    return { brandName: null, address: null, city: null, state: null, employeeCount: null, foundedYear: null };
  }
}

export async function extractMetadata($: cheerio.CheerioAPI, baseUrl: string, bodyText: string): Promise<MetadataResult> {
  const domain = new URL(baseUrl).hostname;

  const description = $('meta[property="og:description"]').attr('content')
    || $('meta[name="description"]').attr('content')
    || null;

  const socials = extractSocials($);

  const fullText = $('body').text().replace(/\s+/g, ' ').trim();
  const gstMatch = fullText.match(GST_REGEX);
  const gstin = gstMatch ? gstMatch[0] : null;

  const pincodeMatch = fullText.match(PINCODE_REGEX);
  const pincode = pincodeMatch ? pincodeMatch[0] : null;

  const businessInfo = await extractBusinessInfo(domain, bodyText);

  return {
    brandName: businessInfo.brandName,
    description,
    socials,
    gstin,
    pincode,
    address: businessInfo.address,
    city: businessInfo.city,
    state: businessInfo.state,
    employeeCount: businessInfo.employeeCount,
    foundedYear: businessInfo.foundedYear,
  };
}
