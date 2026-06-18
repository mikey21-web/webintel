import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth';
import { checkCredits } from '../middleware/credits';
import { rateLimit } from '../middleware/rateLimit';
import { config } from '../config';
import { z } from 'zod';

const navigateSchema = z.object({ url: z.string().url() });

async function sidecarPost(endpoint: string, body?: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${config.CRAWL4AI_SIDECAR_URL}${endpoint}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  return res.json();
}

async function sidecarDelete(endpoint: string): Promise<any> {
  const res = await fetch(`${config.CRAWL4AI_SIDECAR_URL}${endpoint}`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  return res.json();
}

export async function sessionRoutes(app: FastifyInstance) {
  const guard = [requireAuth, rateLimit()];

  app.post('/session', { preHandler: [...guard, checkCredits(20)] }, async (request, reply) => {
    try {
      const data = await sidecarPost('/session', { headless: true });
      return reply.status(201).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: `Session creation failed: ${err.message}` });
    }
  });

  app.get<{ Params: { id: string } }>(
    '/session/:id',
    { preHandler: guard },
    async (request, reply) => {
      try {
        const data = await sidecarPost(`/session/${request.params.id}`);
        return reply.send(data);
      } catch (err: any) {
        if (err.message.includes('not found')) return reply.status(404).send({ error: 'Session not found' });
        return reply.status(502).send({ error: `Session fetch failed: ${err.message}` });
      }
    },
  );

  app.post<{ Params: { id: string }; Body: z.infer<typeof navigateSchema> }>(
    '/session/:id/navigate',
    { preHandler: [...guard, checkCredits(5)] },
    async (request, reply) => {
      const parsed = navigateSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid URL', details: parsed.error.flatten() });
      const { url } = parsed.data;
      try {
        const data = await sidecarPost(`/session/${request.params.id}/navigate`, { url });
        return reply.send(data);
      } catch (err: any) {
        if (err.message.includes('not found')) return reply.status(404).send({ error: 'Session not found' });
        return reply.status(502).send({ error: `Navigation failed: ${err.message}` });
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/session/:id',
    { preHandler: guard },
    async (request, reply) => {
      try {
        const data = await sidecarDelete(`/session/${request.params.id}`);
        return reply.send(data);
      } catch (err: any) {
        if (err.message.includes('not found')) return reply.status(404).send({ error: 'Session not found' });
        return reply.status(502).send({ error: `Session deletion failed: ${err.message}` });
      }
    },
  );
}
