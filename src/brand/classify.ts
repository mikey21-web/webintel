import { askAI } from '../ai';

// EIC (Entrepreneurship Innovation Classification) taxonomy
const EIC_TAXONOMY: Record<string, { code: string; name: string; subindustries: string[] }> = {
  'Software': { code: 'TEC-SW', name: 'Software', subindustries: ['SaaS B2B', 'SaaS B2C', 'Mobile Apps', 'Enterprise Software', 'DevTools', 'AI/ML Platforms'] },
  'E-commerce': { code: 'RET-EC', name: 'E-Commerce', subindustries: ['D2C Brands', 'Marketplace', 'B2B E-Commerce', 'Social Commerce'] },
  'Healthcare': { code: 'HLT-DH', name: 'Digital Health', subindustries: ['Telemedicine', 'Health Analytics', 'Wellness', 'MedTech'] },
  'Fintech': { code: 'FIN-FT', name: 'Financial Technology', subindustries: ['Payments', 'Lending', 'InsurTech', 'WealthTech', 'Neobanking'] },
  'Education': { code: 'EDU-ET', name: 'EdTech', subindustries: ['K-12', 'Higher Ed', 'Upskilling', 'Test Prep', 'Language Learning'] },
  'Food & Beverage': { code: 'CON-FB', name: 'Food & Beverage', subindustries: ['Restaurants', 'Food Delivery', 'Cloud Kitchen', 'Packaged Food'] },
  'Manufacturing': { code: 'IND-MF', name: 'Manufacturing', subindustries: ['Industrial Automation', 'Supply Chain', 'Chemicals', 'Automotive'] },
  'Real Estate': { code: 'PRO-RE', name: 'Real Estate & PropTech', subindustries: ['Residential', 'Commercial', 'Property Management', 'Co-working'] },
  'Logistics': { code: 'TRN-LG', name: 'Logistics & Supply Chain', subindustries: ['Last Mile', 'Warehousing', 'Freight', 'Fleet Management'] },
  'Marketing': { code: 'MAR-AD', name: 'Marketing & Advertising', subindustries: ['Digital Marketing', 'AdTech', 'Content Marketing', 'SEO'] },
  'Agriculture': { code: 'AGR-AG', name: 'AgriTech', subindustries: ['Farm Management', 'Supply Chain', 'Precision Agriculture'] },
  'Cybersecurity': { code: 'TEC-CS', name: 'Cybersecurity', subindustries: ['Network Security', 'Identity', 'Threat Intel', 'Compliance'] },
  'AI/ML': { code: 'TEC-AI', name: 'Artificial Intelligence', subindustries: ['LLM', 'Computer Vision', 'NLP', 'Predictive Analytics'] },
  'Cloud': { code: 'TEC-CL', name: 'Cloud Infrastructure', subindustries: ['IaaS', 'PaaS', 'DevOps', 'Observability'] },
  'Hardware': { code: 'TEC-HW', name: 'Hardware & Semiconductors', subindustries: ['IoT', 'Semiconductors', 'Robotics', 'Consumer Electronics'] },
  'Legal': { code: 'PRO-LG', name: 'LegalTech', subindustries: ['Contract Management', 'Compliance', 'Research'] },
  'HR': { code: 'PRO-HR', name: 'HR & Workforce', subindustries: ['Recruitment', 'Payroll', 'Performance', 'Background Check'] },
  'Travel': { code: 'TRV-HP', name: 'Travel & Hospitality', subindustries: ['Hotels', 'Flights', 'Travel Insurance', 'Experiences'] },
  'Media': { code: 'MED-ME', name: 'Media & Entertainment', subindustries: ['Streaming', 'Publishing', 'Gaming', 'Social Media'] },
  'Energy': { code: 'ENR-CL', name: 'Clean Energy & Sustainability', subindustries: ['Solar', 'EV', 'Carbon Credits', 'Waste Management'] },
  'Biotech': { code: 'HLT-BT', name: 'Biotech & Pharma', subindustries: ['Drug Discovery', 'Genomics', 'Clinical Trials'] },
  'Insurance': { code: 'FIN-IN', name: 'InsurTech', subindustries: ['Life', 'Health', 'Property', 'Auto'] },
  'Blockchain': { code: 'TEC-BC', name: 'Web3 & Blockchain', subindustries: ['DeFi', 'NFT', 'Infrastructure', 'DAOs'] },
  'Construction': { code: 'IND-CN', name: 'Construction & Engineering', subindustries: ['Project Management', 'Materials', 'Safety'] },
};

interface ClassificationResult {
  industry: string | null;
  category: string | null;
  naicsCode: string | null;
  eicCode: string | null;
  eicSubindustry: string | null;
}

export async function classifyBusiness(
  domain: string,
  description: string | null,
  contentExcerpt: string,
): Promise<ClassificationResult | null> {
  try {
    const prompt = `Classify the business at "${domain}".

Use this EIC (Entrepreneurship Innovation Classification) taxonomy:
${JSON.stringify(EIC_TAXONOMY, null, 2)}

Description: ${description || 'N/A'}
Content excerpt: ${contentExcerpt.slice(0, 3000)}

Return ONLY a JSON object (no markdown, no code fences) with these fields:
- industry: the primary industry (e.g., "E-commerce", "SaaS", "Healthcare", "Education")
- category: a more specific sub-category (e.g., "Fashion Retail", "Cloud Computing", "Telemedicine")
- naicsCode: the 6-digit NAICS code if you can determine it, or null
- eicCode: the EIC code from the taxonomy above, or null
- eicSubindustry: the most specific EIC subindustry match, or null

Use null for any field you cannot determine with confidence.`;

    const parsed = await askAI<ClassificationResult>('You are a business classification expert. Return valid JSON only.', prompt);
    return {
      industry: parsed.industry || null,
      category: parsed.category || null,
      naicsCode: parsed.naicsCode || null,
      eicCode: parsed.eicCode || null,
      eicSubindustry: parsed.eicSubindustry || null,
    };
  } catch {
    return null;
  }
}
