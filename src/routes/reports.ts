import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { intelJobs } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { generateReport } from '../reports/generator';

const generateSchema = z.object({
  jobId: z.string().uuid(),
});

export async function reportsRoutes(app: FastifyInstance) {
  app.post('/generate', async (req, reply) => {
    const { jobId } = generateSchema.parse(req.body);
    const [job] = await db.select().from(intelJobs).where(eq(intelJobs.id, jobId));
    if (!job) return reply.status(404).send({ error: 'Job not found' });
    if (job.status !== 'done') return reply.status(400).send({ error: 'Job not completed' });

    const url = await generateReport(job.module, job.result as Record<string, any>);
    return { url };
  });

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const [job] = await db.select().from(intelJobs).where(eq(intelJobs.id, req.params.id));
    if (!job) return reply.status(404).send({ error: 'Job not found' });
    return job;
  });

  app.get('/', async (req) => {
    const jobs = await db.select({
      id: intelJobs.id,
      module: intelJobs.module,
      status: intelJobs.status,
      createdAt: intelJobs.createdAt,
      completedAt: intelJobs.completedAt,
    }).from(intelJobs).where(eq(intelJobs.status, 'done')).orderBy(desc(intelJobs.createdAt)).limit(50);
    return jobs;
  });
}
