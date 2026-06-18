import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth';
import { listContracts, getContract, getContractRuns, deleteContract } from '../extraction/contracts';

export async function contractRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async (req) => {
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
  });

  app.get<{ Params: { id: string } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const contract = await getContract(req.params.id, req.userId!);
    if (!contract) return reply.status(404).send({ error: 'Contract not found' });
    return contract;
  });

  app.get<{ Params: { id: string }; Querystring: { limit?: number; offset?: number } }>(
    '/:id/runs',
    { preHandler: requireAuth },
    async (req, reply) => {
      const contract = await getContract(req.params.id, req.userId!);
      if (!contract) return reply.status(404).send({ error: 'Contract not found' });

      const runs = await getContractRuns(req.params.id, req.query.limit ?? 20, req.query.offset ?? 0);
      return runs;
    },
  );

  app.delete<{ Params: { id: string } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const deleted = await deleteContract(req.params.id, req.userId!);
    if (!deleted) return reply.status(404).send({ error: 'Contract not found' });
    return reply.status(204).send();
  });
}
