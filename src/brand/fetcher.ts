import { load } from 'cheerio';
import { fetch } from 'undici';
import { extractLogo } from './logo';
import { extractColors } from './colors';
import { extractMetadata } from './metadata';
import { detectTechstack } from './techstack';
import { classifyBusiness } from './classify';

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

interface BrandData {
  logo: Awaited<ReturnType<typeof extractLogo>>;
  colors: Awaited<ReturnType<typeof extractColors>>;
  metadata: Awaited<ReturnType<typeof extractMetadata>>;
  techstack: Awaited<ReturnType<typeof detectTechstack>>;
  classification: Awaited<ReturnType<typeof classifyBusiness>>;
}

export async function fetchBrand(domain: string) {
  const url = `https://${domain}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);

  const html = await res.text();
  const $ = load(html);
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000);

  const [logoResult, colorsResult, metadataResult, techstackResult, classificationResult] = await Promise.allSettled([
    extractLogo($, url),
    extractColors(html),
    extractMetadata($, url, bodyText),
    detectTechstack(html),
    classifyBusiness(domain, $('meta[property="og:description"]').attr('content') || null, bodyText),
  ]);

  const logo = logoResult.status === 'fulfilled' ? logoResult.value : null;
  const colors = colorsResult.status === 'fulfilled' ? colorsResult.value : { primary: null, palette: [], fonts: [], styleguide: {} };
  const metadata = metadataResult.status === 'fulfilled' ? metadataResult.value : { description: null, socials: {}, gstin: null, pincode: null, address: null, city: null, state: null, employeeCount: null, foundedYear: null };
  const techstack = techstackResult.status === 'fulfilled' ? techstackResult.value : [];
  const classification = classificationResult.status === 'fulfilled' ? classificationResult.value : null;

  return {
    logoUrl: logo?.cdnUrl || null,
    logoVariants: null,
    primaryColor: colors.primary,
    palette: colors.palette,
    fonts: colors.fonts,
    styleguide: colors.styleguide,
    description: metadata.description || null,
    tagline: null,
    category: classification?.category || null,
    industry: classification?.industry || null,
    naicsCode: classification?.naicsCode || null,
    eicCode: classification?.eicCode || null,
    eicSubindustry: classification?.eicSubindustry || null,
    address: metadata.address || null,
    city: metadata.city || null,
    state: metadata.state || null,
    country: 'India',
    pincode: metadata.pincode || null,
    gstNumber: metadata.gstin || null,
    socials: metadata.socials || {},
    waTheme: {},
    employeeCount: metadata.employeeCount != null ? String(metadata.employeeCount) : null,
    foundedYear: metadata.foundedYear,
    techStack: techstack,
    fetchedAt: new Date(),
    expiresAt: addDays(new Date(), 7),
  };
}
