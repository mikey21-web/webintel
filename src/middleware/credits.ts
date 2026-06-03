import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client';
import { creditBalances, usageLogs } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

export function checkCredits(cost: number) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userId) return reply.status(401).send({ error: 'Unauthorized' });

    const [balance] = await db.select().from(creditBalances).where(eq(creditBalances.userId, request.userId)).limit(1);

    if (!balance || (balance.creditsRemaining ?? 0) < cost) {
      return reply.status(402).send({
        error: 'Insufficient credits',
        creditsRequired: cost,
        creditsRemaining: balance?.creditsRemaining ?? 0,
      });
    }

    await db.update(creditBalances)
      .set({ creditsRemaining: sql`credits_remaining - ${cost}`, creditsUsedCycle: sql`credits_used_cycle + ${cost}` })
      .where(eq(creditBalances.userId, request.userId));
  };
}

export async function logUsage(apiKeyId: string, endpoint: string, credits: number, status: number, durationMs: number, url?: string, module?: string) {
  await db.insert(usageLogs).values({
    apiKeyId,
    endpoint,
    credits,
    status,
    durationMs: durationMs ?? 0,
    url: url ?? null,
    module: module ?? null,
    createdAt: new Date(),
  } as any).catch(() => {});
}
