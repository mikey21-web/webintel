import * as cheerio from 'cheerio';
import { domainToUrl } from '../utils/domain';
import { config } from '../config';

export interface ScrapedPage {
  url: string;
  html: string;
  text: string;
  title: string;
  metaDescription: string;
  headings: { level: string; text: string }[];
  links: string[];
  statusCode: number;
}

export async function scrapeUrl(url: string): Promise<ScrapedPage> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(15000),
  });
  const html = await response.text();
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, aside').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000);
  const title = $('title').text().trim();
  const metaDescription = $('meta[name="description"]').attr('content') || '';
  const headings: { level: string; text: string }[] = [];
  for (let i = 1; i <= 6; i++) {
    $(`h${i}`).each((_, el) => { headings.push({ level: `h${i}`, text: $(el).text().trim() }); return; });
  }
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) links.push(href);
    return;
  });
  return { url, html, text, title, metaDescription, headings, links, statusCode: response.status };
}

export async function scrapeDomain(domain: string, paths: string[] = ['/', '/pricing', '/features', '/about', '/customers', '/careers']): Promise<Record<string, ScrapedPage>> {
  const baseUrl = domainToUrl(domain);
  const results: Record<string, ScrapedPage> = {};
  for (const path of paths) {
    try {
      const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
      results[path] = await scrapeUrl(url);
    } catch (err) {
      if (err instanceof Error) console.error(`Failed to scrape ${path}:`, err.message);
    }
  }
  return results;
}
