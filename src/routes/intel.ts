import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { intelJobs } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { getIntelQueue } from '../queue/setup';
import { requireAuth } from '../middleware/auth';
import { checkCredits, logUsage } from '../middleware/credits';
import { rateLimit } from '../middleware/rateLimit';
import { responseCache } from '../middleware/cache';
import { normalizeDomain } from '../utils/domain';

const competitorSchema = z.object({
  domain: z.string(),
  depth: z.number().min(1).max(3).optional().default(1),
  wait: z.boolean().optional(),
  webhookUrl: z.string().url().optional(),
});

const marketMapSchema = z.object({
  keyword: z.string(),
  location: z.string().optional(),
  limit: z.number().max(25).optional().default(15),
  wait: z.boolean().optional(),
  webhookUrl: z.string().url().optional(),
});

const leadSchema = z.object({
  domains: z.array(z.string()).min(1).max(10),
  context: z.string().optional(),
  wait: z.boolean().optional(),
  webhookUrl: z.string().url().optional(),
});

const salesBriefSchema = z.object({
  targetDomain: z.string(),
  yourProduct: z.string(),
  yourDomain: z.string(),
  wait: z.boolean().optional(),
  webhookUrl: z.string().url().optional(),
});

const pricingSchema = z.object({
  domain: z.string(),
  wait: z.boolean().optional(),
  webhookUrl: z.string().url().optional(),
});

const techStackSchema = z.object({
  domain: z.string(),
  wait: z.boolean().optional(),
  webhookUrl: z.string().url().optional(),
});

const compareSchema = z.object({
  domains: z.array(z.string()).min(2).max(10),
  wait: z.boolean().optional(),
  webhookUrl: z.string().url().optional(),
});

async function enqueueAndPoll(module: string, input: Record<string, any>, apiKeyId: string, wait?: boolean) {
  const webhookUrl = input.webhookUrl;
  delete input.webhookUrl;
  delete input.wait;
  const [job] = await db.insert(intelJobs).values({
    module,
    input,
    status: 'queued',
    apiKeyId,
    webhookUrl: webhookUrl ?? null,
  }).returning();
  const queue = getIntelQueue();
  await queue.add('intel', { jobId: job.id, module, input, webhookUrl });
  if (wait) {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      const [current] = await db.select().from(intelJobs).where(eq(intelJobs.id, job.id));
      if (!current) break;
      if (current.status === 'done') return { jobId: job.id, status: 'done', result: current.result };
      if (current.status === 'failed') return { jobId: job.id, status: 'failed', error: current.error };
    }
    return { jobId: job.id, status: 'timeout' };
  }
  return { jobId: job.id };
}

export async function intelRoutes(app: FastifyInstance) {
  app.post('/competitor', { preHandler: [requireAuth, rateLimit(), checkCredits(50)] }, async (req, reply) => {
    const input = competitorSchema.parse(req.body);
    input.domain = normalizeDomain(input.domain);
    const result = await enqueueAndPoll('competitor', input, req.apiKeyId!, input.wait);
    return result;
  });

  app.post('/market-map', { preHandler: [requireAuth, rateLimit(), checkCredits(50)] }, async (req, reply) => {
    const input = marketMapSchema.parse(req.body);
    const result = await enqueueAndPoll('market_map', input, req.apiKeyId!, input.wait);
    return result;
  });

  app.post('/lead', { preHandler: [requireAuth, rateLimit(), checkCredits(20)] }, async (req, reply) => {
    const input = leadSchema.parse(req.body);
    const result = await enqueueAndPoll('lead_intel', input, req.apiKeyId!, input.wait);
    return result;
  });

  app.post('/sales-brief', { preHandler: [requireAuth, rateLimit(), checkCredits(50)] }, async (req, reply) => {
    const input = salesBriefSchema.parse(req.body);
    input.targetDomain = normalizeDomain(input.targetDomain);
    input.yourDomain = normalizeDomain(input.yourDomain);
    const result = await enqueueAndPoll('sales_brief', input, req.apiKeyId!, input.wait);
    return result;
  });

  app.post('/pricing', { preHandler: [requireAuth, rateLimit(), checkCredits(30)] }, async (req, reply) => {
    const input = pricingSchema.parse(req.body);
    input.domain = normalizeDomain(input.domain);
    const result = await enqueueAndPoll('pricing_intel', input, req.apiKeyId!, input.wait);
    return result;
  });

  app.post('/tech-stack', { preHandler: [requireAuth, rateLimit(), checkCredits(20)] }, async (req, reply) => {
    const input = techStackSchema.parse(req.body);
    input.domain = normalizeDomain(input.domain);
    const result = await enqueueAndPoll('tech_stack', input, req.apiKeyId!, input.wait);
    return result;
  });

  app.post('/compare', { preHandler: [requireAuth, rateLimit(), checkCredits(20)] }, async (req, reply) => {
    const input = compareSchema.parse(req.body);
    input.domains = input.domains.map(normalizeDomain);
    const result = await enqueueAndPoll('compare', input, req.apiKeyId!, input.wait);
    return result;
  });

  app.get<{ Params: { jobId: string } }>('/:jobId', { preHandler: [requireAuth] }, async (req, reply) => {
    const [job] = await db.select().from(intelJobs).where(eq(intelJobs.id, req.params.jobId));
    if (!job) return reply.status(404).send({ error: 'Job not found' });
    return job;
  });

  app.get('/history', { preHandler: [requireAuth] }, async (req) => {
    const jobs = await db.select().from(intelJobs).where(eq(intelJobs.apiKeyId, req.apiKeyId!)).orderBy(desc(intelJobs.createdAt)).limit(50);
    return jobs;
  });
}
