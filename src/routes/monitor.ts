import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { monitors, monitorAlerts } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';

const createMonitorSchema = z.object({
  url: z.string().url(),
  interval: z.enum(['hourly', 'daily', 'weekly']).optional().default('daily'),
  selector: z.string().optional(),
  label: z.string().optional(),
});

const updateMonitorSchema = z.object({
  url: z.string().url().optional(),
  interval: z.enum(['hourly', 'daily', 'weekly']).optional(),
  selector: z.string().optional(),
  label: z.string().optional(),
  active: z.boolean().optional(),
});

export async function monitorRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const input = createMonitorSchema.parse(req.body);
    const [monitor] = await db.insert(monitors).values({
      name: input.label ?? `Monitor ${input.url}`,
      urls: [input.url],
      checkInterval: input.interval,
      active: true,
      userId: req.userId!,
    }).returning();
    return reply.status(201).send(monitor);
  });

  app.get('/', { preHandler: requireAuth }, async (req) => {
    const all = await db.select().from(monitors)
      .where(eq(monitors.userId, req.userId!))
      .orderBy(desc(monitors.createdAt));
    return all;
  });

  app.get<{ Params: { id: string } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const [monitor] = await db.select().from(monitors)
      .where(and(eq(monitors.id, req.params.id), eq(monitors.userId, req.userId!)));
    if (!monitor) return reply.status(404).send({ error: 'Monitor not found' });
    const alerts = await db.select().from(monitorAlerts)
      .where(eq(monitorAlerts.monitorId, monitor.id))
      .orderBy(desc(monitorAlerts.createdAt))
      .limit(10);
    return { ...monitor, recentAlerts: alerts };
  });

  app.patch<{ Params: { id: string } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const input = updateMonitorSchema.parse(req.body);
    const [updated] = await db.update(monitors)
      .set(input)
      .where(and(eq(monitors.id, req.params.id), eq(monitors.userId, req.userId!)))
      .returning();
    if (!updated) return reply.status(404).send({ error: 'Monitor not found' });
    return updated;
  });

  app.delete<{ Params: { id: string } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const [deleted] = await db.delete(monitors)
      .where(and(eq(monitors.id, req.params.id), eq(monitors.userId, req.userId!)))
      .returning();
    if (!deleted) return reply.status(404).send({ error: 'Monitor not found' });
    return reply.status(204).send();
  });

  app.get<{ Params: { id: string } }>('/:id/alerts', { preHandler: requireAuth }, async (req, reply) => {
    const [monitor] = await db.select().from(monitors)
      .where(and(eq(monitors.id, req.params.id), eq(monitors.userId, req.userId!)));
    if (!monitor) return reply.status(404).send({ error: 'Monitor not found' });
    const alerts = await db.select().from(monitorAlerts)
      .where(eq(monitorAlerts.monitorId, req.params.id))
      .orderBy(desc(monitorAlerts.createdAt))
      .limit(50);
    return alerts;
  });

  app.patch<{ Params: { id: string; alertId: string } }>('/:id/alerts/:alertId/seen', { preHandler: requireAuth }, async (req, reply) => {
    const [updated] = await db.update(monitorAlerts)
      .set({ seen: true })
      .where(and(eq(monitorAlerts.id, req.params.alertId), eq(monitorAlerts.monitorId, req.params.id)))
      .returning();
    if (!updated) return reply.status(404).send({ error: 'Alert not found' });
    return updated;
  });
}
