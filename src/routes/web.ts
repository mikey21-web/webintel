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
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';

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
          return reply.status(502).send({ error: `Scrape failed: ${err.message}` });
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
        return reply.status(502).send({ error: `Sitemap fetch failed: ${err.message}` });
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
        return reply.status(502).send({ error: `Screenshot failed: ${err.message}` });
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
      } as any);

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

  app.post<{ Body: { url: string; prompt?: string } }>(
    '/extract',
    { preHandler: [...guard, checkCredits(CREDIT_COST.extract)] },
    async (request, reply) => {
      const start = Date.now();
      const { url, prompt } = request.body;
      if (!url) return reply.status(400).send({ error: 'url is required' });

      try {
        const result = await sidecarScrape(url, { waitFor: 2000 });
        const extracted = await runExtraction(result.markdown, prompt);
        recordUsage(request, 'extract', CREDIT_COST.extract, 200, start, url);
        return reply.send({ url, extracted, metadata: result.metadata });
      } catch (err: any) {
        recordUsage(request, 'extract', 0, 500, start, url);
        return reply.status(502).send({ error: `Extraction failed: ${err.message}` });
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
        return reply.status(502).send({ error: `Query failed: ${err.message}` });
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
  const { askAI } = await import('../ai');
  const systemPrompt = prompt
    ? `Extract the following information from the page content. Return JSON only.\n\n${prompt}`
    : 'Extract all structured data from this page: company name, description, email, phone, social links, pricing, and key features. Return JSON only.';

  try {
    return await askAI<Record<string, any>>(systemPrompt, markdown.slice(0, 80000));
  } catch {
    return { raw: markdown.slice(0, 5000) };
  }
}

async function answerQuestion(markdown: string, question: string): Promise<string> {
  const { askAI } = await import('../ai');
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
