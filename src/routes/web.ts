import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { crawlJobs } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { checkCredits, logUsage } from '../middleware/credits';
import { rateLimit } from '../middleware/rateLimit';
import { responseCache } from '../middleware/cache';
import { sidecarScrape } from '../scraping/sidecar';
import { uploadToR2 as r2Upload, getFromR2 as r2Get, r2PublicUrl } from '../storage/r2';
import { getCrawlQueue } from '../queue/setup';
import { askAI } from '../ai';
import { searchGoogle } from '../scraping/search';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { sanitizeError } from '../utils/errors';

const CREDIT_COST = { scrape: 5, sitemap: 10, screenshot: 8, crawl: 25, extract: 15, query: 3 };

async function recordUsage(request: any, endpoint: string, credits: number, status: number, start: number, url?: string, mod?: string) {
  logUsage(request.apiKeyId!, endpoint, credits, status, Date.now() - start, url, mod);
}

export async function webRoutes(app: FastifyInstance) {
  const guard = [requireAuth, rateLimit()];

  function scrapeEndpoint(endpoint: string, format: 'markdown' | 'html' | 'images', credits: number) {
    const creditCheck = checkCredits(credits);
    app.post<{ Body: { url: string; waitFor?: number; useJs?: boolean; stealth?: boolean } }>(
      `/${endpoint}`,
      { preHandler: [...guard, creditCheck] },
      async (request, reply) => {
        const start = Date.now();
        const { url, waitFor, useJs, stealth } = request.body;
        if (!url) return reply.status(400).send({ error: 'url is required' });

        try {
          const result = await sidecarScrape(url, { waitFor, useJs, screenshot: false, stealth });

          let data: any;
          if (format === 'markdown') {
            data = { markdown: result.markdown, metadata: result.metadata, source: result.source };
          } else if (format === 'html') {
            data = { html: result.html, metadata: result.metadata, source: result.source };
          } else {
            data = { images: [], metadata: result.metadata, source: result.source };
          }

          recordUsage(request, `scrape/${format}`, credits, 200, start, url);
          return reply.send(data);
        } catch (err: any) {
          recordUsage(request, `scrape/${format}`, 0, 500, start, url);
          return reply.status(502).send({ error: `Scrape failed: ${sanitizeError(err)}` });
        }
      },
    );
  }

  scrapeEndpoint('scrape/markdown', 'markdown', CREDIT_COST.scrape);
  scrapeEndpoint('scrape/html', 'html', CREDIT_COST.scrape);
  scrapeEndpoint('scrape/images', 'images', CREDIT_COST.scrape);

  app.post<{ Body: { url: string } }>(
    '/sitemap',
    { preHandler: [...guard, checkCredits(CREDIT_COST.sitemap), responseCache(3600)] },
    async (request, reply) => {
      const start = Date.now();
      const { url } = request.body;
      if (!url) return reply.status(400).send({ error: 'url is required' });

      try {
        const result = await sidecarScrape(url, { waitFor: 2000 });
        const urls = extractSitemapUrls(result.markdown, url);
        recordUsage(request, 'sitemap', CREDIT_COST.sitemap, 200, start, url);
        return reply.send({ urls, count: urls.length, source: url });
      } catch (err: any) {
        recordUsage(request, 'sitemap', 0, 500, start, url);
        return reply.status(502).send({ error: `Sitemap fetch failed: ${sanitizeError(err)}` });
      }
    },
  );

  app.post<{ Body: { url: string; fullPage?: boolean; waitFor?: number } }>(
    '/screenshot',
    { preHandler: [...guard, checkCredits(CREDIT_COST.screenshot)] },
    async (request, reply) => {
      const start = Date.now();
      const { url, fullPage, waitFor } = request.body;
      if (!url) return reply.status(400).send({ error: 'url is required' });

      try {
        const result = await sidecarScrape(url, { screenshot: true, fullPage, waitFor });
        const screenshotKey = `screenshots/${crypto.randomUUID()}.png`;
        if (result.screenshotBase64) {
          const buffer = Buffer.from(result.screenshotBase64, 'base64');
          await r2Upload(screenshotKey, buffer, 'image/png');
        }
        recordUsage(request, 'screenshot', CREDIT_COST.screenshot, 200, start, url);
        return reply.send({
          screenshotUrl: `${r2PublicUrl}/${screenshotKey}`,
          metadata: result.metadata,
        });
      } catch (err: any) {
        recordUsage(request, 'screenshot', 0, 500, start, url);
        return reply.status(502).send({ error: `Screenshot failed: ${sanitizeError(err)}` });
      }
    },
  );

  app.post<{ Body: { url: string; maxPages?: number; webhookUrl?: string; wait?: boolean } }>(
    '/crawl',
    { preHandler: [...guard, checkCredits(CREDIT_COST.crawl)] },
    async (request, reply) => {
      const start = Date.now();
      const { url, maxPages = 10, webhookUrl, wait } = request.body;
      if (!url) return reply.status(400).send({ error: 'url is required' });

      const jobId = crypto.randomUUID();
      await db.insert(crawlJobs).values({
        id: jobId,
        apiKeyId: request.apiKeyId!,
        url,
        maxPages,
        status: 'queued',
      });

      await getCrawlQueue().add('crawl', {
        jobId,
        url,
        maxPages,
        apiKeyId: request.apiKeyId!,
      });

      recordUsage(request, 'crawl', CREDIT_COST.crawl, 202, start, url);

      if (wait === true) {
        return reply.send({ jobId, status: 'queued', message: 'Crawl enqueued. Use GET /crawl/:jobId for status (wait not yet supported)' });
      }

      return reply.status(202).send({ jobId, status: 'queued' });
    },
  );

  app.post<{ Body: { url: string; maxPages?: number } }>(
    '/crawl/stream',
    { preHandler: [...guard, checkCredits(CREDIT_COST.crawl)] },
    async (request, reply) => {
      const start = Date.now();
      const { url, maxPages = 10 } = request.body;
      if (!url) return reply.status(400).send({ error: 'url is required' });

      let aborted = false;
      request.raw.on('close', () => { aborted = true; });

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      const sendEvent = (event: string, data: any) => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      sendEvent('start', { url, maxPages, status: 'crawling' });

      try {
        const result = await sidecarScrape(url, { waitFor: 2000 });
        sendEvent('page', { url, markdownLength: result.markdown.length, metadata: result.metadata });
        sendEvent('progress', { pagesCrawled: 1, totalPages: maxPages });

        const linkRegex = /https?:\/\/[^\s"'<>)+]+/g;
        const links = [...new Set((result.markdown.match(linkRegex) || [])
          .map((l: string) => l.replace(/[.,;:!?)]+$/, ''))
          .filter((l: string) => l.startsWith(new URL(url).origin))
        )].slice(0, maxPages - 1);

        let pagesCrawled = 1;
        for (const link of links) {
          if (pagesCrawled >= maxPages || aborted) break;
          try {
            const pageResult = await sidecarScrape(link, { waitFor: 1000 });
            pagesCrawled++;
            sendEvent('page', { url: link, markdownLength: pageResult.markdown.length, metadata: pageResult.metadata });
            sendEvent('progress', { pagesCrawled, totalPages: maxPages });
          } catch (err) {
            if (err instanceof Error) console.error('Failed to scrape page in crawl:', err.message);
          }
        }

        sendEvent('complete', { pagesCrawled, status: 'done' });
        recordUsage(request, 'crawl/stream', CREDIT_COST.crawl, 200, start, url);
      } catch (err: any) {
        sendEvent('error', { error: sanitizeError(err), status: 'failed' });
        recordUsage(request, 'crawl/stream', 0, 500, start, url);
      }

      reply.raw.end();
    },
  );

  app.get<{ Params: { jobId: string } }>(
    '/crawl/:jobId',
    { preHandler: guard },
    async (request, reply) => {
      const [job] = await db
        .select()
        .from(crawlJobs)
        .where(eq(crawlJobs.id, request.params.jobId))
        .limit(1);
      if (!job) return reply.status(404).send({ error: 'Crawl job not found' });
      if (job.apiKeyId !== request.apiKeyId) return reply.status(403).send({ error: 'Unauthorized' });

      return reply.send({
        jobId: job.id,
        status: job.status,
        url: job.url,
        pagesCrawled: job.pagesCrawled,
        error: job.error,
        result: job.result,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      });
    },
  );

  app.post<{ Body: { url: string; schema?: Record<string, any>; prompt?: string } }>(
    '/extract',
    { preHandler: [...guard, checkCredits(CREDIT_COST.extract)] },
    async (request, reply) => {
      const start = Date.now();
      const { url, schema, prompt } = request.body;
      if (!url) return reply.status(400).send({ error: 'url is required' });

      try {
        const result = await sidecarScrape(url, { waitFor: 2000 });
        if (schema) {
          const { data, confidence } = await runSchemaExtraction(result.markdown, schema);
          recordUsage(request, 'extract', CREDIT_COST.extract, 200, start, url);
          return reply.send({ url, data, confidence, metadata: result.metadata });
        }
        const extracted = await runExtraction(result.markdown, prompt);
        recordUsage(request, 'extract', CREDIT_COST.extract, 200, start, url);
        return reply.send({ url, extracted, metadata: result.metadata });
      } catch (err: any) {
        recordUsage(request, 'extract', 0, 500, start, url);
        return reply.status(502).send({ error: `Extraction failed: ${sanitizeError(err)}` });
      }
    },
  );

  app.post<{ Body: { url: string; question: string } }>(
    '/query',
    { preHandler: [...guard, checkCredits(CREDIT_COST.query)] },
    async (request, reply) => {
      const start = Date.now();
      const { url, question } = request.body;
      if (!url || !question) return reply.status(400).send({ error: 'url and question are required' });

      try {
        const result = await sidecarScrape(url, { waitFor: 2000 });
        const answer = await answerQuestion(result.markdown, question);
        recordUsage(request, 'query', CREDIT_COST.query, 200, start, url);
        return reply.send({ url, question, answer, metadata: result.metadata });
      } catch (err: any) {
        recordUsage(request, 'query', 0, 500, start, url);
        return reply.status(502).send({ error: `Query failed: ${sanitizeError(err)}` });
      }
    },
  );

  app.post<{ Body: { query: string; numResults?: number } }>(
    '/search',
    { preHandler: [...guard, checkCredits(CREDIT_COST.query)] },
    async (request, reply) => {
      const start = Date.now();
      const { query, numResults = 10 } = request.body;
      if (!query) return reply.status(400).send({ error: 'query is required' });

      try {
        const results = await searchGoogle(query, numResults);
        recordUsage(request, 'search', CREDIT_COST.query, 200, start, query);
        return reply.send({ query, results, totalResults: results.length });
      } catch (err: any) {
        recordUsage(request, 'search', 0, 500, start, query);
        return reply.status(502).send({ error: `Search failed: ${sanitizeError(err)}` });
      }
    },
  );

  app.get<{ Querystring: { domain?: string; name?: string } }>(
    '/naics',
    { preHandler: [...guard, checkCredits(10)] },
    async (request, reply) => {
      const start = Date.now();
      const { domain, name } = request.query;
      if (!domain && !name) return reply.status(400).send({ error: 'domain or name query parameter required' });

      try {
        const target = domain || name;
        const result = await askAI<{ naicsCode: string | null; naicsDescription: string | null; confidence: number }>(
          'You are a NAICS classification expert. Use the 2022 NAICS taxonomy.',
          `Classify the business "${target}" and return the most specific 6-digit NAICS code.
           Return ONLY JSON: {"naicsCode": "123456", "naicsDescription": "Description", "confidence": 0.95}
           Use null for any field you cannot determine.`
        );
        recordUsage(request, 'naics', 10, 200, start, target);
        return reply.send({
          input: target,
          naicsCode: result.naicsCode || null,
          naicsDescription: result.naicsDescription || null,
          confidence: typeof result.confidence === 'number' ? result.confidence : 0,
        });
      } catch (err: any) {
        recordUsage(request, 'naics', 0, 500, start, domain || name);
        return reply.status(502).send({ error: `NAICS lookup failed: ${sanitizeError(err)}` });
      }
    },
  );

  app.get<{ Querystring: { domain?: string; name?: string; type?: string } }>(
    '/sic',
    { preHandler: [...guard, checkCredits(10)] },
    async (request, reply) => {
      const start = Date.now();
      const { domain, name, type = 'latest_sec' } = request.query;
      if (!domain && !name) return reply.status(400).send({ error: 'domain or name query parameter required' });

      try {
        const target = domain || name;
        const sicType = type === 'original_sic' ? '1987 SIC' : 'SEC current SIC';
        const result = await askAI<{ sicCode: string | null; sicDescription: string | null; confidence: number }>(
          `You are a SIC classification expert. Use the ${sicType} taxonomy.`,
          `Classify the business "${target}" and return the most specific SIC code.
           Return ONLY JSON: {"sicCode": "1234", "sicDescription": "Description", "confidence": 0.95}
           Use null for any field you cannot determine.`
        );
        recordUsage(request, 'sic', 10, 200, start, target);
        return reply.send({
          input: target,
          sicCode: result.sicCode || null,
          sicDescription: result.sicDescription || null,
          classification: type === 'original_sic' ? 'original_sic' : 'latest_sec',
          confidence: typeof result.confidence === 'number' ? result.confidence : 0,
        });
      } catch (err: any) {
        recordUsage(request, 'sic', 0, 500, start, domain || name);
        return reply.status(502).send({ error: `SIC lookup failed: ${sanitizeError(err)}` });
      }
    },
  );

  app.post<{ Body: { url: string } }>(
    '/extract-product',
    { preHandler: [...guard, checkCredits(10)] },
    async (request, reply) => {
      const start = Date.now();
      const { url } = request.body;
      if (!url) return reply.status(400).send({ error: 'url is required' });

      try {
        const result = await sidecarScrape(url, { waitFor: 3000 });
        const product = await askAI<{
          isProduct: boolean;
          name: string | null;
          description: string | null;
          price: string | null;
          currency: string | null;
          billingFrequency: string | null;
          pricingModel: string | null;
          features: string[];
          category: string | null;
          targetAudience: string | null;
          tags: string[];
          images: string[];
          sku: string | null;
        }>(
          'You are a product page extraction expert. Extract product details from the page content.',
          `Analyze this page content and extract product information.
           First determine if this IS a product page. If not, set isProduct: false and all other fields null.
           
           Page content:
           ${result.markdown.slice(0, 40000)}

           Return ONLY JSON with these fields:
           - isProduct: boolean
           - name: string or null
           - description: string or null
           - price: string or null (extract exact price text)
           - currency: string or null (USD, INR, EUR, etc.)
           - billingFrequency: string or null (one_time, monthly, yearly, or null)
           - pricingModel: string or null (free, freemium, flat, tiered, usage_based, or null)
           - features: string[]
           - category: string or null
           - targetAudience: string or null
           - tags: string[]
           - images: string[]
           - sku: string or null`
        );
        recordUsage(request, 'extract-product', 10, 200, start, url);
        return reply.send({ url, product, metadata: result.metadata });
      } catch (err: any) {
        recordUsage(request, 'extract-product', 0, 500, start, url);
        return reply.status(502).send({ error: `Product extraction failed: ${sanitizeError(err)}` });
      }
    },
  );

  app.post<{ Body: { domain: string; maxProducts?: number } }>(
    '/extract-products',
    { preHandler: [...guard, checkCredits(10)] },
    async (request, reply) => {
      const start = Date.now();
      const { domain, maxProducts = 10 } = request.body;
      if (!domain) return reply.status(400).send({ error: 'domain is required' });

      try {
        // First scrape the brand homepage to discover product pages
        const homepage = await sidecarScrape(`https://${domain}`, { waitFor: 2000 });
        const discoveryPrompt = `From the page content below, identify up to ${maxProducts} product page URLs.
          Look for links to individual product pages, pricing plans, or service offerings.
          
          Content:
          ${homepage.markdown.slice(0, 30000)}
          
          Return ONLY JSON: {"productUrls": ["url1", "url2", ...]}`;

        const discovery = await askAI<{ productUrls: string[] }>(
          'You are a product discovery expert. Identify product page URLs from homepage content.',
          discoveryPrompt
        );

        const productUrls = (discovery.productUrls || []).slice(0, maxProducts);
        const products: any[] = [];

        for (const productUrl of productUrls) {
          try {
            const page = await sidecarScrape(productUrl, { waitFor: 2000 });
            const product = await askAI<any>(
              'Extract product details from this page.',
              `Extract: name, description, price, currency, features, category.
               Page: ${page.markdown.slice(0, 20000)}
               Return ONLY JSON.`
            );
            products.push({ url: productUrl, ...product });
          } catch (err) {
            if (err instanceof Error) console.error('Failed to extract product:', err.message);
          }
        }

        recordUsage(request, 'extract-products', 10, 200, start, domain);
        return reply.send({ domain, products, totalFound: products.length });
      } catch (err: any) {
        recordUsage(request, 'extract-products', 0, 500, start, domain);
        return reply.status(502).send({ error: `Product sweep failed: ${sanitizeError(err)}` });
      }
    },
  );
}

function extractSitemapUrls(markdown: string, baseUrl: string): string[] {
  const urlRegex = /https?:\/\/[^\s"'<>]+/g;
  const matches = markdown.match(urlRegex) ?? [];
  const base = new URL(baseUrl);
  const urls = matches
    .map(m => m.replace(/[.,;:!?)]+$/, ''))
    .filter(m => m.startsWith(base.origin))
    .filter((v, i, a) => a.indexOf(v) === i);
  return urls.slice(0, 500);
}

async function runExtraction(markdown: string, prompt?: string): Promise<Record<string, any>> {
  const systemPrompt = prompt
    ? `Extract the following information from the page content. Return JSON only.\n\n${prompt}`
    : 'Extract all structured data from this page: company name, description, email, phone, social links, pricing, and key features. Return JSON only.';

  try {
    return await askAI<Record<string, any>>(systemPrompt, markdown.slice(0, 80000));
  } catch {
    return { raw: markdown.slice(0, 5000) };
  }
}

async function runSchemaExtraction(markdown: string, schema: Record<string, any>): Promise<{ data: Record<string, any>; confidence: Record<string, number> }> {
  const systemPrompt = `You are a precise data extractor. Extract the requested fields from the page content.

JSON Schema for extraction:
${JSON.stringify(schema, null, 2)}

Return a JSON object with:
- "data": an object with the extracted values matching the schema
- "confidence": an object with the same keys, each value is a confidence score 0-1

For each field:
- 1.0 = directly found on the page
- 0.7 = inferred from context
- 0.3 = guessed with low confidence
- 0.0 = not found

Return ONLY valid JSON.`;

  try {
    return await askAI<{ data: Record<string, any>; confidence: Record<string, number> }>(systemPrompt, markdown.slice(0, 80000));
  } catch {
    return { data: {}, confidence: {} };
  }
}

async function answerQuestion(markdown: string, question: string): Promise<string> {
  try {
    return await askAI<string>(
      'Answer concisely based on the page content.',
      `Based on the following page content, answer the question concisely.\n\nPAGE CONTENT:\n${markdown.slice(0, 80000)}\n\nQUESTION: ${question}`,
      'text'
    );
  } catch {
    return 'Could not generate answer';
  }
}
