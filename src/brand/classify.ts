import { askAI } from '../ai';

interface ClassificationResult {
  industry: string | null;
  category: string | null;
  naicsCode: string | null;
}

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

    const parsed = await askAI<ClassificationResult>('You are a business classification expert. Return valid JSON only.', prompt);
    return {
      industry: parsed.industry || null,
      category: parsed.category || null,
      naicsCode: parsed.naicsCode || null,
    };
  } catch {
    return null;
  }
}
