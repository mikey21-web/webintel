import { scrapeDomain } from '../../scraping';
import { askAI } from '../../ai';

const PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'React', regex: /react\.?js|react\.?dom|__NEXT_DATA|next\.?js/i },
  { name: 'Vue.js', regex: /vue\.?js|vue\.?router|nuxt/i },
  { name: 'Angular', regex: /angular|ng-version/i },
  { name: 'Svelte', regex: /svelte/i },
  { name: 'jQuery', regex: /jquery/i },
  { name: 'Tailwind CSS', regex: /tailwindcss|tailwind/i },
  { name: 'Bootstrap', regex: /bootstrap/i },
  { name: 'TypeScript', regex: /typescript/i },
  { name: 'Node.js', regex: /nodejs|node\.js|express/i },
  { name: 'Python', regex: /python|django|flask|fastapi/i },
  { name: 'PHP', regex: /php|laravel|wordpress|wp-content/i },
  { name: 'Ruby', regex: /ruby|rails/i },
  { name: 'Java', regex: /java|spring|jsp/i },
  { name: 'Go', regex: /golang|go\s+lang/i },
  { name: 'Rust', regex: /rust/i },
  { name: '.NET', regex: /\.net|asp\.net|c#/i },
  { name: 'PostgreSQL', regex: /postgresql|postgres/i },
  { name: 'MySQL', regex: /mysql|mariadb/i },
  { name: 'MongoDB', regex: /mongodb|mongoose/i },
  { name: 'Redis', regex: /redis/i },
  { name: 'Elasticsearch', regex: /elasticsearch/i },
  { name: 'Docker', regex: /docker/i },
  { name: 'Kubernetes', regex: /kubernetes|k8s/i },
  { name: 'AWS', regex: /aws|amazon\s+web\s+services|cloudfront/i },
  { name: 'Google Cloud', regex: /gcp|google\s+cloud/i },
  { name: 'Azure', regex: /azure|microsoft\s+azure/i },
  { name: 'Cloudflare', regex: /cloudflare/i },
  { name: 'Vercel', regex: /vercel/i },
  { name: 'Netlify', regex: /netlify/i },
  { name: 'Nginx', regex: /nginx/i },
  { name: 'Apache', regex: /apache/i },
  { name: 'GraphQL', regex: /graphql|apollo/i },
  { name: 'REST', regex: /rest\s*api|restful/i },
  { name: 'WebSocket', regex: /websocket|socket\.io/i },
  { name: 'Stripe', regex: /stripe/i },
  { name: 'Algolia', regex: /algolia/i },
  { name: 'Cloudinary', regex: /cloudinary/i },
  { name: 'SendGrid', regex: /sendgrid|twilio\s+sendgrid/i },
  { name: 'Google Analytics', regex: /google-analytics|ga\.js|gtag/i },
  { name: 'HubSpot', regex: /hubspot|hs-analytics/i },
  { name: 'Intercom', regex: /intercom/i },
  { name: 'Zendesk', regex: /zendesk/i },
  { name: 'Shopify', regex: /shopify/i },
  { name: 'WooCommerce', regex: /woocommerce/i },
  { name: 'Auth0', regex: /auth0/i },
  { name: 'Clerk', regex: /clerk\./i },
  { name: 'Supabase', regex: /supabase/i },
  { name: 'Firebase', regex: /firebase|firestore/i },
];

export interface TechStackResult {
  domain: string;
  detected: { technology: string; source: string; confidence: number }[];
}

export async function runTechStackIntel(domain: string): Promise<TechStackResult> {
  const pages = await scrapeDomain(domain, ['/']);
  const homeHtml = Object.values(pages)[0]?.html || '';

  const patternDetected = new Map<string, string[]>();
  for (const { name, regex } of PATTERNS) {
    const matches = homeHtml.match(regex);
    if (matches) {
      const existing = patternDetected.get(name) || [];
      existing.push('pattern');
      patternDetected.set(name, existing);
    }
  }

  const homeText = Object.values(pages)[0]?.text?.slice(0, 4000) || '';
  if (homeText) {
    const claudeDetected = await askAI<string[]>(
      'You are a tech stack analyst. Identify technologies used by a company based on website content. Return a JSON array of strings.',
      `Identify the technology stack used by ${domain} from this content:\n\n${homeText}\n\nReturn a JSON array of technology names (e.g., ["React", "PostgreSQL", "AWS"]). Only include technologies you are highly confident about.`
    ).catch(() => [] as string[]);

    for (const tech of claudeDetected) {
      const existing = patternDetected.get(tech) || [];
      existing.push('claude');
      patternDetected.set(tech, existing);
    }
  }

  const merged = [...patternDetected.entries()].map(([technology, sources]) => ({
    technology,
    source: [...new Set(sources)].join('+'),
    confidence: sources.includes('pattern') && sources.includes('claude') ? 0.95 : sources.includes('pattern') ? 0.7 : 0.5,
  })).sort((a, b) => b.confidence - a.confidence);

  return { domain, detected: merged };
}
