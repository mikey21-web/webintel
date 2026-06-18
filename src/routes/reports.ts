import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { intelJobs, reports, apiKeys } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import { generateReport } from '../reports/generator';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { sanitizeError } from '../utils/errors';

const generateSchema = z.object({
  jobId: z.string().uuid(),
});

export async function reportsRoutes(app: FastifyInstance) {
  const guard = [requireAuth, rateLimit()];

  app.post('/generate', { preHandler: guard }, async (req, reply) => {
    try {
      const { jobId } = generateSchema.parse(req.body);
      const [job] = await db
        .select({
          id: intelJobs.id,
          module: intelJobs.module,
          status: intelJobs.status,
          result: intelJobs.result,
        })
        .from(intelJobs)
        .innerJoin(apiKeys, eq(intelJobs.apiKeyId, apiKeys.id))
        .where(and(
          eq(intelJobs.id, jobId),
          eq(apiKeys.userId, req.userId!)
        ));
      if (!job) return reply.status(404).send({ error: 'Job not found' });
      if (job.status !== 'done') return reply.status(400).send({ error: 'Job not completed' });

      const url = await generateReport(job.module, job.result as Record<string, any>);
      await db.insert(reports).values({
        userId: req.userId!,
        intelJobId: jobId,
        title: `${job.module} report`,
        reportType: job.module,
        pdfUrl: url,
      } as any);
      return { url };
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: sanitizeError(err) });
    }
  });

  app.get<{ Params: { id: string } }>('/:id', { preHandler: guard }, async (req, reply) => {
    try {
      const [report] = await db.select().from(reports)
        .where(and(eq(reports.id, req.params.id), eq(reports.userId, req.userId!)));
      if (!report) return reply.status(404).send({ error: 'Report not found' });
      return report;
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: sanitizeError(err) });
    }
  });

  app.get('/', { preHandler: guard }, async (req) => {
    try {
      const rows = await db.select({
        id: reports.id,
        title: reports.title,
        reportType: reports.reportType,
        pdfUrl: reports.pdfUrl,
        createdAt: reports.createdAt,
      }).from(reports)
        .where(eq(reports.userId, req.userId!))
        .orderBy(desc(reports.createdAt))
        .limit(50);
      return rows;
    } catch (err: any) {
      return { error: sanitizeError(err) };
    }
  });
}
