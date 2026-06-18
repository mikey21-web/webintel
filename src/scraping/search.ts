import * as cheerio from 'cheerio';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function searchGoogle(query: string, numResults = 10): Promise<SearchResult[]> {
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${numResults}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];
    $('div.g').each((_, el) => {
      const titleEl = $(el).find('h3');
      const linkEl = $(el).find('a[href]').first();
      const snippetEl = $(el).find('div[data-sncf], span.aCOpRe, div.VwiC3b');
      if (titleEl.length && linkEl.length) {
        const href = linkEl.attr('href') || '';
        const match = href.match(/https?:\/\/[^&]+/);
        results.push({
          title: titleEl.text().trim(),
          url: match ? match[0] : href,
          snippet: snippetEl.first().text().trim(),
        });
      }
    });
    if (results.length > 0) return results;
  } catch {
    // Fall through to fallback
  }

  try {
    const fallbackUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(fallbackUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(15000),
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];
    $('.result').each((_, el) => {
      const titleEl = $(el).find('.result__title a');
      const snippetEl = $(el).find('.result__snippet');
      const href = titleEl.attr('href') || '';
      const match = href.match(/uddg=([^&]+)/);
      if (titleEl.length) {
        results.push({
          title: titleEl.text().trim(),
          url: match ? decodeURIComponent(match[1]) : href,
          snippet: snippetEl.first().text().trim(),
        });
      }
    });
    if (results.length > 0) return results.slice(0, numResults);
  } catch {
    // Fall through
  }

  throw new Error(`Search failed for query: ${query}`);
}
