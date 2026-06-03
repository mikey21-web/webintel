import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { creditBalances, usageLogs } from '../db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { hashApiKey } from '../utils/hash';
import { apiKeys } from '../db/schema';

export async function usageRoutes(app: FastifyInstance) {
  app.get('/usage', { preHandler: [requireAuth] }, async (request, reply) => {
    const [balance] = await db
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.userId, request.userId!))
      .limit(1);

    return reply.send({
      creditsRemaining: balance?.creditsRemaining ?? 0,
      creditsUsedCycle: balance?.creditsUsedCycle ?? 0,
      cycleResetAt: balance?.resetAt,
      userId: request.userId,
    });
  });

  app.get<{ Querystring: { from?: string; to?: string; limit?: string; offset?: string } }>(
    '/usage/history',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const limit = Math.min(parseInt(request.query.limit ?? '50', 10), 200);
      const offset = parseInt(request.query.offset ?? '0', 10);

      const conditions = [eq(usageLogs.apiKeyId, request.apiKeyId!)];

      if (request.query.from) {
        conditions.push(gte(usageLogs.createdAt, new Date(request.query.from)));
      }
      if (request.query.to) {
        conditions.push(lte(usageLogs.createdAt, new Date(request.query.to)));
      }

      const rows = await db
        .select()
        .from(usageLogs)
        .where(and(...conditions))
        .orderBy(usageLogs.createdAt)
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(usageLogs)
        .where(and(...conditions));

      return reply.send({ logs: rows, limit, offset, total: Number(count) });
    },
  );
}
