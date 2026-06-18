// ---------------------------------------------------------------------------
// Structured SERP Parser
// Parses JS-rendered Google SERP HTML into typed structured data.
// Relies on the sidecar for JS rendering (not the legacy static-HTML fetch).
// ---------------------------------------------------------------------------

export interface OrganicResult {
  title: string;
  url: string;
  snippet: string;
  sitelinks?: string[];
  richSnippet?: RichSnippetData;
}

export interface RichSnippetData {
  type: 'rating' | 'faq' | 'product' | 'recipe' | 'event';
  fields: Record<string, string>;
}

export interface PeopleAlsoAskItem {
  question: string;
  answer: string;
  sourceUrl?: string;
  sourceTitle?: string;
}

export interface FeaturedSnippet {
  type: 'paragraph' | 'list' | 'table';
  content: string;
  items?: string[];
  sourceUrl: string;
  sourceTitle: string;
}

export interface KnowledgeGraph {
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  url?: string;
  attributes: Record<string, string>;
}

export interface LocalPlace {
  name: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  phone?: string;
  openNow?: boolean;
  hours?: string;
}

export interface LocalPackResult {
  places: LocalPlace[];
  mapUrl?: string;
}

export interface PaidResult {
  title: string;
  url: string;
  displayUrl: string;
  snippet: string;
  extensions?: string[];
}

export interface SerpResult {
  organic: OrganicResult[];
  peopleAlsoAsk: PeopleAlsoAskItem[];
  featuredSnippet: FeaturedSnippet | null;
  knowledgeGraph: KnowledgeGraph | null;
  localPack: LocalPackResult | null;
  relatedSearches: string[];
  paidResults: PaidResult[];
  searchMetadata: {
    totalResults?: number | string;
    searchTimeSec?: number;
  };
}

// ---------------------------------------------------------------------------
// Cheerio-style selectors for different SERP sections
// (These selectors target Google's JS-rendered DOM)
// ---------------------------------------------------------------------------

function extractText(el: any): string {
  if (!el) return '';
  if (typeof el === 'string') return el.trim();
  const text = el.text ? el.text().trim() : String(el).trim();
  return text.replace(/\s+/g, ' ').trim();
}

function extractHref(el: any): string {
  if (!el) return '';
  if (typeof el.attr === 'function') {
    return (el.attr('href') || '').replace('/url?q=', '').split('&')[0] || '';
  }
  return '';
}

// ---------------------------------------------------------------------------

export function parseSerp(html: string): SerpResult {
  // We use simple regex + string parsing since we don't have cheerio in this module.
  // The sidecar returns JS-rendered HTML which has consistent data attributes.

  const result: SerpResult = {
    organic: [],
    peopleAlsoAsk: [],
    featuredSnippet: null,
    knowledgeGraph: null,
    localPack: null,
    relatedSearches: [],
    paidResults: [],
    searchMetadata: {},
  };

  result.organic = extractOrganicResults(html);
  result.peopleAlsoAsk = extractPeopleAlsoAsk(html);
  result.featuredSnippet = extractFeaturedSnippet(html);
  result.knowledgeGraph = extractKnowledgeGraph(html);
  result.localPack = extractLocalPack(html);
  result.relatedSearches = extractRelatedSearches(html);
  result.paidResults = extractPaidResults(html);

  // Metadata
  const totalMatch = html.match(/(?:About\s+)?([\d,]+)\s+results?/i);
  if (totalMatch) {
    result.searchMetadata.totalResults = totalMatch[1];
  }
  const timeMatch = html.match(/([\d.]+)\s*seconds?/i);
  if (timeMatch) {
    result.searchMetadata.searchTimeSec = parseFloat(timeMatch[1]);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Organic results
// ---------------------------------------------------------------------------

function extractOrganicResults(html: string): OrganicResult[] {
  const results: OrganicResult[] = [];

  // Look for result blocks with links
  const linkPattern = /<a\s+(?:[^>]*?\s)?href="\/url\?q=([^"&]+)[^"]*"[^>]*>(?:<h3[^>]*>)?([\s\S]*?)(?:<\/h3>)?<\/a>/gi;
  const snippetPattern = /<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

  let m;
  // Simpler approach: find all organic result containers
  const blocks = html.split(/<div[^>]*class="[^"]*g[^"]*"[^>]*>/g).slice(1);

  for (const block of blocks.slice(0, 20)) {
    const titleMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const urlMatch = block.match(/href="\/url\?q=([^"&]+)/);
    const snippetMatch = block.match(/<span[^>]*>(?:<em>)?([\s\S]*?)(?:<\/em>)?<\/span>/);

    if (urlMatch?.[1]) {
      const title = titleMatch ? extractTextFromHtml(titleMatch[1]) : '';
      const url = decodeURIComponent(urlMatch[1]);
      const snippet = snippetMatch ? extractTextFromHtml(snippetMatch[1]) : '';

      if (title || snippet) {
        results.push({ title, url, snippet });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// People Also Ask
// ---------------------------------------------------------------------------

function extractPeopleAlsoAsk(html: string): PeopleAlsoAskItem[] {
  const items: PeopleAlsoAskItem[] = [];
  const paaPattern = /<div[^>]*class="[^"]*related-question-pair[^"]*"[^>]*>([\s\S]*?)<div[^>]*class="[^"]*related-question-pair[^"]*"/gi;

  // Try to find PAA question/answer pairs
  const questionPattern = /<div[^>]*>(?:<span[^>]*>)?([A-Z][^<]{5,200}?\?)<\/span>/gi;

  let m;
  while ((m = questionPattern.exec(html)) !== null && items.length < 10) {
    const question = m[1].trim();
    if (!items.some((i) => i.question === question)) {
      items.push({ question, answer: '' });
    }
  }

  // Look for answer blocks after each question
  if (items.length === 0) {
    const qnaBlocks = html.match(
      /(?:<div[^>]*role="heading"[^>]*>(?:<span>)?([\s\S]*?\?)(?:<\/span>)?<\/div>[\s\S]*?<div[^>]*>(<span[^>]*>[\s\S]*?<\/span>)<\/div>)/gi,
    );
    if (qnaBlocks) {
      for (const block of qnaBlocks) {
        const qMatch = block.match(/([\w\s,()-]{10,200}\?)/);
        if (qMatch) {
          items.push({ question: qMatch[1].trim(), answer: extractTextFromHtml(block) });
        }
      }
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Featured Snippet
// ---------------------------------------------------------------------------

function extractFeaturedSnippet(html: string): FeaturedSnippet | null {
  // Look for featured snippet block
  const snippetBlocks = [
    /<div[^>]*class="[^"]*xpdopen[^"]*"[^>]*>/,
    /<div[^>]*class="[^"]*kp-blk[^"]*"[^>]*>/,
    /<div[^>]*data-tts="answers"[^>]*>/,
  ];

  for (const pattern of snippetBlocks) {
    const match = html.match(pattern);
    if (match) {
      const endIdx = html.indexOf('</div>', match.index! + 500);
      const block = html.slice(match.index!, endIdx > 0 ? endIdx : match.index! + 2000);

      const text = extractTextFromHtml(block);
      const sourceUrl = (block.match(/href="\/url\?q=([^"&]+)/) || [])[1] || '';
      const sourceTitle = extractTextFromHtml(
        (block.match(/<a[^>]*href="\/url\?q=[^"]*"[^>]*>([\s\S]*?)<\/a>/) || [])[1] || '',
      );

      const isList = block.includes('<li>') || block.includes('<ol>');
      const isTable = block.includes('<table>');

      const items = isList
        ? (block.match(/<li[^>]*>([\s\S]*?)<\/li>/g) || []).map((li) => extractTextFromHtml(li))
        : undefined;

      return {
        type: isTable ? 'table' : isList ? 'list' : 'paragraph',
        content: text.slice(0, 1000),
        items,
        sourceUrl: decodeURIComponent(sourceUrl),
        sourceTitle,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Knowledge Graph
// ---------------------------------------------------------------------------

function extractKnowledgeGraph(html: string): KnowledgeGraph | null {
  const kgMatch = html.match(/<div[^>]*class="[^"]*kp-wholepage[^"]*"[^>]*>/);
  let matchIndex: number;

  if (kgMatch) {
    matchIndex = kgMatch.index!;
  } else {
    const cardMatch = html.match(
      /<div[^>]*class="[^"]*kp-header[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*kp-wholepage[^"]*"/,
    );
    if (!cardMatch) return null;
    matchIndex = cardMatch.index!;
  }
  const kgEnd = html.indexOf(
    '<div class="g"',
    matchIndex + 500,
  );
  const kgHtml = html.slice(matchIndex, kgEnd > 0 ? kgEnd : matchIndex + 5000);

  const title = extractTextFromHtml(
    (kgHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || kgHtml.match(/<div[^>]*data-attrid="title"[^>]*>([\s\S]*?)<\/div>/))?.[1] || '',
  );

  const subtitle = extractTextFromHtml(
    (kgHtml.match(/<div[^>]*data-attrid="subtitle"[^>]*>([\s\S]*?)<\/div>/))?.[1] || '',
  );

  const description = extractTextFromHtml(
    (kgHtml.match(/<span[^>]*>(?:<span>)?([A-Z][\s\S]{50,500}?)(?:<\/span>)?<\/span>/))?.[1] || '',
  ).slice(0, 500);

  const imageUrl = (kgHtml.match(/img[^>]*src="([^"]+)"/) || [])[1] || '';
  const url = decodeURIComponent((kgHtml.match(/href="\/url\?q=([^"&]+)/) || [])[1] || '');

  const attributes: Record<string, string> = {};
  const attrMatches = kgHtml.matchAll(
    /<div[^>]*data-attrid="([^"]+)"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/g,
  );
  for (const m of attrMatches) {
    if (m[1] !== 'title' && m[1] !== 'subtitle') {
      attributes[m[1]] = extractTextFromHtml(m[2]);
    }
  }

  if (!title && !description && Object.keys(attributes).length === 0) return null;

  return { title, subtitle: subtitle || undefined, description: description || undefined, imageUrl: imageUrl || undefined, url: url || undefined, attributes };
}

// ---------------------------------------------------------------------------
// Local Pack
// ---------------------------------------------------------------------------

function extractLocalPack(html: string): LocalPackResult | null {
  const packMatch = html.match(/<div[^>]*class="[^"]*m6QErb[^"]*"[^>]*>/);
  if (!packMatch) return null;

  const packIndex = packMatch.index!;
  const packEnd = html.indexOf('<div class="g"', packIndex + 500);
  const packHtml = html.slice(packIndex, packEnd > 0 ? packEnd : packIndex + 5000);

  const places: LocalPlace[] = [];
  const placeBlocks = packHtml.match(/<div[^>]*class="[^"]*VkpGBb[^"]*"[^>]*>/g) || [];

  for (const block of placeBlocks.slice(0, 5)) {
    const name = extractTextFromHtml((block.match(/<div[^>]*class="[^"]*OSrXXb[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '');
    const ratingMatch = block.match(/([\d.]+)\s*\((\d+)\)/);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : undefined;
    const reviewCount = ratingMatch ? parseInt(ratingMatch[2]) : undefined;
    const address = extractTextFromHtml((block.match(/<div[^>]*>([\d]+\s[\w\s,]+)<\/div>/) || [])[1] || '');

    if (name) {
      places.push({ name, rating, reviewCount, address: address || undefined });
    }
  }

  const mapUrl = decodeURIComponent((packHtml.match(/href="\/url\?q=([^"&]*maps[^"&]*)/) || [])[1] || '');

  if (places.length === 0) return null;
  return { places, mapUrl: mapUrl || undefined };
}

// ---------------------------------------------------------------------------
// Related Searches
// ---------------------------------------------------------------------------

function extractRelatedSearches(html: string): string[] {
  const searches: string[] = [];
  const relatedPattern = /<a[^>]*href="\/search\?q=[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  let m;
  // Find the "Related searches" section
  const relatedSection = html.match(/People also search for|Related searches/i);
  if (relatedSection) {
    const sectionStart = relatedSection.index!;
    const sectionHtml = html.slice(sectionStart, sectionStart + 3000);
    while ((m = relatedPattern.exec(sectionHtml)) !== null && searches.length < 8) {
      const text = extractTextFromHtml(m[1]);
      if (text.length > 2 && !searches.includes(text)) {
        searches.push(text);
      }
    }
  }

  return searches;
}

// ---------------------------------------------------------------------------
// Paid / Ad Results
// ---------------------------------------------------------------------------

function extractPaidResults(html: string): PaidResult[] {
  const results: PaidResult[] = [];
  const adPattern = /<div[^>]*class="[^"]*uEierd[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;

  let m;
  while ((m = adPattern.exec(html)) !== null && results.length < 5) {
    const block = m[1];
    const title = extractTextFromHtml((block.match(/<span[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '');
    const urlMatch = block.match(/href="\/url\?q=([^"&]+)/);
    const url = urlMatch ? decodeURIComponent(urlMatch[1]) : '';
    const displayUrl = extractTextFromHtml((block.match(/<div[^>]*class="[^"]*MUxGbd[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '');
    const snippet = extractTextFromHtml(
      (block.match(/<div[^>]*class="[^"]*yDYNvb[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '',
    );

    if (url) {
      results.push({ title, url, displayUrl, snippet });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractTextFromHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, (m) => {
      const map: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&nbsp;': ' ',
      };
      return map[m] || m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}
