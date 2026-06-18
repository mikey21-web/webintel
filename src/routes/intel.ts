import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { intelJobs } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import { getIntelQueue } from '../queue/setup';
import { requireAuth } from '../middleware/auth';
import { checkCredits } from '../middleware/credits';
import { rateLimit } from '../middleware/rateLimit';
import { normalizeDomain } from '../utils/domain';
import { sanitizeError } from '../utils/errors';

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

const guard = [requireAuth, rateLimit()];

export async function intelRoutes(app: FastifyInstance) {
  app.post('/competitor', { preHandler: [...guard, checkCredits(50)] }, async (req, reply) => {
    try {
      const input = competitorSchema.parse(req.body);
      input.domain = normalizeDomain(input.domain);
      const result = await enqueueAndPoll('competitor', input, req.apiKeyId!, input.wait);
      return result;
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: sanitizeError(err) });
    }
  });

  app.post('/market-map', { preHandler: [...guard, checkCredits(50)] }, async (req, reply) => {
    try {
      const input = marketMapSchema.parse(req.body);
      const result = await enqueueAndPoll('market_map', input, req.apiKeyId!, input.wait);
      return result;
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: sanitizeError(err) });
    }
  });

  app.post('/lead', { preHandler: [...guard, checkCredits(20)] }, async (req, reply) => {
    try {
      const input = leadSchema.parse(req.body);
      const result = await enqueueAndPoll('lead_intel', input, req.apiKeyId!, input.wait);
      return result;
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: sanitizeError(err) });
    }
  });

  app.post('/sales-brief', { preHandler: [...guard, checkCredits(50)] }, async (req, reply) => {
    try {
      const input = salesBriefSchema.parse(req.body);
      input.targetDomain = normalizeDomain(input.targetDomain);
      input.yourDomain = normalizeDomain(input.yourDomain);
      const result = await enqueueAndPoll('sales_brief', input, req.apiKeyId!, input.wait);
      return result;
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: sanitizeError(err) });
    }
  });

  app.post('/pricing', { preHandler: [...guard, checkCredits(30)] }, async (req, reply) => {
    try {
      const input = pricingSchema.parse(req.body);
      input.domain = normalizeDomain(input.domain);
      const result = await enqueueAndPoll('pricing_intel', input, req.apiKeyId!, input.wait);
      return result;
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: sanitizeError(err) });
    }
  });

  app.post('/tech-stack', { preHandler: [...guard, checkCredits(20)] }, async (req, reply) => {
    try {
      const input = techStackSchema.parse(req.body);
      input.domain = normalizeDomain(input.domain);
      const result = await enqueueAndPoll('tech_stack', input, req.apiKeyId!, input.wait);
      return result;
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: sanitizeError(err) });
    }
  });

  app.post('/compare', { preHandler: [...guard, checkCredits(20)] }, async (req, reply) => {
    try {
      const input = compareSchema.parse(req.body);
      input.domains = input.domains.map(normalizeDomain);
      const result = await enqueueAndPoll('compare', input, req.apiKeyId!, input.wait);
      return result;
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: sanitizeError(err) });
    }
  });

  app.get<{ Params: { jobId: string } }>('/:jobId', { preHandler: guard }, async (req, reply) => {
    try {
      const [job] = await db.select().from(intelJobs).where(and(
        eq(intelJobs.id, req.params.jobId),
        eq(intelJobs.apiKeyId, req.apiKeyId!)
      ));
      if (!job) return reply.status(404).send({ error: 'Job not found' });
      return job;
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: sanitizeError(err) });
    }
  });

  app.get('/history', { preHandler: guard }, async (req) => {
    try {
      const jobs = await db.select().from(intelJobs).where(eq(intelJobs.apiKeyId, req.apiKeyId!)).orderBy(desc(intelJobs.createdAt)).limit(50);
      return jobs;
    } catch (err: any) {
      return { error: sanitizeError(err) };
    }
  });
}
