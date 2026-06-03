import Anthropic from '@anthropic-ai/sdk';
import { sidecarScrape } from '../../scraping/sidecar';

const client = new Anthropic();

export async function runCompare(domains: string[]) {
  if (domains.length < 2 || domains.length > 5) {
    throw new Error('Compare requires 2-5 domains');
  }

  // Scrape all domains in parallel
  const scrapeResults = await Promise.allSettled(
    domains.map(d => sidecarScrape(`https://${d}`, { useJs: true }).catch(() => null))
  );

  const contents = domains
    .map((d, i) => ({
      domain: d,
      content: scrapeResults[i].status === 'fulfilled' && scrapeResults[i].value
        ? scrapeResults[i].value!.markdown.slice(0, 3000) : null,
    }))
    .filter(c => c.content);

  if (contents.length < 2) throw new Error('Could not scrape enough domains for comparison');

  const context = contents.map(c => `=== ${c.domain} ===\n${c.content}`).join('\n\n');

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: 'You are a competitive intelligence analyst. Compare companies side by side. Respond ONLY with valid JSON.',
    messages: [{
      role: 'user',
      content: `Compare these companies side by side.

${context}

Respond with this exact JSON:
{
  "comparisonMatrix": {
    "featureOrAspect": { "domain1": "value", "domain2": "value", ... }
  },
  "pricingComparison": [
    { "domain": "string", "tiers": ["string"], "priceRange": "string", "model": "string" }
  ],
  "targetAudienceComparison": {
    "domain1": "string — who they target",
    "domain2": "string"
  },
  "marketPositioning": "string — 2-3 sentences on how they position differently",
  "strengthMap": { "domain1": "string — their strongest advantage", "domain2": "..." },
  "weaknessMap": { "domain1": "string — their biggest gap", "domain2": "..." },
  "recommendation": "string — who wins and why",
  "overallScores": { "domain1": number 1-10, "domain2": number 1-10 }
}`,
    }],
  });

  const text = (msg.content[0] as { type: 'text'; text: string }).text;
  return { domains, comparedAt: new Date().toISOString(), ...JSON.parse(text.replace(/```json|```/g, '').trim()) };
}
