import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { listContracts, getContract, getContractRuns, deleteContract } from '../extraction/contracts';
import { sanitizeError } from '../utils/errors';

export async function contractRoutes(app: FastifyInstance) {
  const guard = [requireAuth, rateLimit()];

  app.get('/', { preHandler: guard }, async (req) => {
    try {
      const contracts = await listContracts(req.userId!);
      return contracts.map((c) => ({
        id: c.id,
        url: c.url,
        name: c.name,
        schema: c.schema,
        lastRunAt: c.lastRunAt,
        lastHealedAt: c.lastHealedAt,
        runCount: c.runCount,
        active: c.active,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
    } catch (err: any) {
      return { error: sanitizeError(err) };
    }
  });

  app.get<{ Params: { id: string } }>('/:id', { preHandler: guard }, async (req, reply) => {
    try {
      const contract = await getContract(req.params.id, req.userId!);
      if (!contract) return reply.status(404).send({ error: 'Contract not found' });
      return contract;
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: sanitizeError(err) });
    }
  });

  app.get<{ Params: { id: string }; Querystring: { limit?: number; offset?: number } }>(
    '/:id/runs',
    { preHandler: guard },
    async (req, reply) => {
      try {
        const contract = await getContract(req.params.id, req.userId!);
        if (!contract) return reply.status(404).send({ error: 'Contract not found' });

        const runs = await getContractRuns(req.params.id, req.query.limit ?? 20, req.query.offset ?? 0);
        return runs;
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({ error: sanitizeError(err) });
      }
    },
  );

  app.delete<{ Params: { id: string } }>('/:id', { preHandler: guard }, async (req, reply) => {
    try {
      const deleted = await deleteContract(req.params.id, req.userId!);
      if (!deleted) return reply.status(404).send({ error: 'Contract not found' });
      return reply.status(204).send();
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: sanitizeError(err) });
    }
  });
}
