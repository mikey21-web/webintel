import { sidecarScrape } from '../../scraping/sidecar';
import { askAI } from '../../ai';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+91[-\s]?)?(?:\d[-\s]?){10,11}/g;
const INDIAN_MOBILE = /(?:\+91[-\s]?|0)?[6789]\d{9}/g;

export async function runEnrich(domain: string) {
  // Scrape contact pages
  const pagesToScrape = [
    `https://${domain}`,
    `https://${domain}/contact`,
    `https://${domain}/about`,
    `https://${domain}/team`,
  ];

  const scrapeResults = await Promise.allSettled(
    pagesToScrape.map(url => sidecarScrape(url, { useJs: false }).catch(() => null))
  );

  const allHtml = scrapeResults
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => (r as PromiseFulfilledResult<any>).value!.html)
    .join('\n');

  const allMarkdown = scrapeResults
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => (r as PromiseFulfilledResult<any>).value!.markdown)
    .join('\n');

  // Extract emails from HTML (mailto: links)
  const emailsFromHtml = [...allHtml.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)]
    .map(m => m[1].toLowerCase());

  // Extract emails from text content
  const emailsFromText = [...allMarkdown.matchAll(EMAIL_REGEX)]
    .map(m => m[0].toLowerCase());

  const allEmails = [...new Set([...emailsFromHtml, ...emailsFromText])].filter(e => {
    // Filter out generic/no-reply emails, keep real people
    const blacklist = ['noreply', 'no-reply', 'donotreply', 'support@', 'info@', 'hello@', 'hi@', 'careers@', 'jobs@', 'hr@', 'admin@'];
    return !blacklist.some(b => e.startsWith(b));
  });

  // Extract Indian phone numbers
  const phones = [...new Set([...allMarkdown.matchAll(INDIAN_MOBILE)].map(m => m[0]))];

  // Use AI to validate + find decision makers
  const result = await askAI<any>(
    'Extract contact information from business websites. Respond only with JSON.',
    `Extract decision-maker contact info from this Indian business website.

Domain: ${domain}
Content:
${allMarkdown.slice(0, 4000)}

Potential emails found: ${allEmails.join(', ') || 'none'}
Potential phones found: ${phones.join(', ') || 'none'}

Respond with JSON:
{
  "foundEmails": ["valid email addresses only"],
  "foundPhones": ["valid Indian phone numbers"],
  "decisionMakers": [
    { "name": "string or null", "role": "string or null", "email": "string or null" }
  ],
  "sources": {"emails": ["which pages"], "phones": ["which pages"]},
  "confidence": number 0-1
}`
  );

  return { domain, ...result, enrichedAt: new Date().toISOString() };
}
