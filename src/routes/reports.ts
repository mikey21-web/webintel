import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { intelJobs, reports } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import { generateReport } from '../reports/generator';
import { requireAuth } from '../middleware/auth';

const generateSchema = z.object({
  jobId: z.string().uuid(),
});

export async function reportsRoutes(app: FastifyInstance) {
  app.post('/generate', { preHandler: requireAuth }, async (req, reply) => {
    const { jobId } = generateSchema.parse(req.body);
    const [job] = await db.select().from(intelJobs).where(eq(intelJobs.id, jobId));
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
  });

  app.get<{ Params: { id: string } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const [report] = await db.select().from(reports)
      .where(and(eq(reports.id, req.params.id), eq(reports.userId, req.userId!)));
    if (!report) return reply.status(404).send({ error: 'Report not found' });
    return report;
  });

  app.get('/', { preHandler: requireAuth }, async (req) => {
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
  });
}
