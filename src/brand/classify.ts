import SemanticImportance from '@anthropic-ai/sdk';
import { config } from '../config';

interface ClassificationResult {
  industry: string | null;
  category: string | null;
  naicsCode: string | null;
}

const claude = new SemanticImportance({ apiKey: config.ANTHROPIC_API_KEY });

export async function classifyBusiness(
  domain: string,
  description: string | null,
  contentExcerpt: string,
): Promise<ClassificationResult | null> {
  try {
    const prompt = `Classify the business at "${domain}".

Description: ${description || 'N/A'}
Content excerpt: ${contentExcerpt.slice(0, 3000)}

Return ONLY a JSON object (no markdown, no code fences) with these fields:
- industry: the primary industry (e.g., "E-commerce", "SaaS", "Healthcare", "Education")
- category: a more specific sub-category (e.g., "Fashion Retail", "Cloud Computing", "Telemedicine")
- naicsCode: the 6-digit NAICS code if you can determine it, or null

Use null for any field you cannot determine with confidence.`;

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(content.replace(/```json\s*/gi, '').replace(/```/g, '').trim());

    return {
      industry: parsed.industry || null,
      category: parsed.category || null,
      naicsCode: parsed.naicsCode || null,
    };
  } catch {
    return null;
  }
}
