import * as cheerio from 'cheerio';

export interface TechItem {
  name: string;
  category: string;
  confidence: number;
}

interface TechSignature {
  name: string;
  category: string;
  regex: RegExp;
}

const TECH_SIGNATURES: TechSignature[] = [
  { name: 'React', category: 'framework', regex: /react(\.js|\.development\.js)?["\']?[\)>]|data-reactroot|__NEXT_DATA__/i },
  { name: 'Next.js', category: 'framework', regex: /__NEXT_DATA__|next\.js|\.next\/static/i },
  { name: 'Vue.js', category: 'framework', regex: /vue(\.js|\.runtime)?["\']?[\)>]|__VUE__|data-v-/i },
  { name: 'Nuxt.js', category: 'framework', regex: /__NUXT__|nuxt\.js/i },
  { name: 'Angular', category: 'framework', regex: /ng-version=|ng-app|angular(\.js|\.min\.js)/i },
  { name: 'Svelte', category: 'framework', regex: /__svelte|svelte\.(mjs|js)/i },
  { name: 'jQuery', category: 'library', regex: /jquery(\.min)?\.js/i },
  { name: 'Lodash', category: 'library', regex: /lodash(\.min)?\.js/i },
  { name: 'GSAP', category: 'animation', regex: /gsap|tweenmax|timelinemax/i },
  { name: 'Three.js', category: '3d', regex: /three(\.min)?\.js|webgl/i },
  { name: 'Tailwind CSS', category: 'css', regex: /tailwind|\.tw-|class=["\'][^"]*\s+(sm:|md:|lg:|xl:)/i },
  { name: 'Bootstrap', category: 'css', regex: /bootstrap(\.min)?\.(css|js)|data-bs-/i },
  { name: 'WordPress', category: 'cms', regex: /\/wp-content\/|\/wp-includes\/|wp-emoji-release\.min\.js/i },
  { name: 'Shopify', category: 'ecommerce', regex: /shopify|myshopify\.com|cdn\.shopify/i },
  { name: 'WooCommerce', category: 'ecommerce', regex: /woocommerce|wc-cart-fragments/i },
  { name: 'Magento', category: 'ecommerce', regex: /magento|mage\/|requirejs\/|varien/i },
  { name: 'Laravel', category: 'backend', regex: /laravel|csrf-token.*content=["\']?[^"\']+["\']?>/i },
  { name: 'Drupal', category: 'cms', regex: /drupal|drupal\.settings/i },
  { name: 'Cloudflare', category: 'hosting', regex: /cloudflare|__cfduid/i },
  { name: 'Vercel', category: 'hosting', regex: /vercel|__VERCEL/i },
  { name: 'Netlify', category: 'hosting', regex: /netlify|_netlify/i },
  { name: 'Google Analytics', category: 'analytics', regex: /gtag|google-analytics|ga\(|analytics\.js/i },
  { name: 'Facebook Pixel', category: 'analytics', regex: /fbq\(|facebook.*pixel|connect\.facebook\.net\/en_US\/fbevents/i },
  { name: 'Hotjar', category: 'analytics', regex: /hotjar|hj\.bootstrap/i },
  { name: 'HubSpot', category: 'crm', regex: /hubspot|js\.hs-scripts\.com/i },
  { name: 'Intercom', category: 'crm', regex: /intercom|widget\.intercom\.io/i },
  { name: 'Sentry', category: 'monitoring', regex: /sentry\.min\.js|raven\.min\.js/i },
  { name: 'Alpine.js', category: 'framework', regex: /alpinejs|alpine\.min\.js|x-data|x-init/i },
  { name: 'HTMX', category: 'library', regex: /htmx(\.min)?\.js|hx-get|hx-post|hx-trigger/i },
  { name: 'Tally', category: 'forms', regex: /tally\.so|tally\.xyz/i },
  { name: 'Typeform', category: 'forms', regex: /typeform|tf-(?:variation|popup)/i },
];

export function detectTechstack(html: string): TechItem[] {
  const $ = cheerio.load(html);
  const scriptSrc = new Set<string>();
  const linkHref = new Set<string>();

  $('script[src]').each((_: number, el: any) => { scriptSrc.add($(el).attr('src') || ''); });
  $('link[href]').each((_: number, el: any) => { linkHref.add($(el).attr('href') || ''); });

  const allUrls = [...scriptSrc, ...linkHref].join(' ');

  const detected: TechItem[] = [];

  for (const sig of TECH_SIGNATURES) {
    const inHtml = sig.regex.test(html);
    const inUrls = sig.regex.test(allUrls);

    if (inHtml || inUrls) {
      let confidence = 0.5;
      if (inUrls) confidence += 0.3;
      if (sig.regex.toString().includes('__NEXT_DATA__') || sig.regex.toString().includes('__NUXT__')) {
        confidence = 0.95;
      }

      detected.push({ name: sig.name, category: sig.category, confidence: Math.min(confidence, 1) });
    }
  }

  return detected;
}
