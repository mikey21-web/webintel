import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client';
import { apiKeys, users } from '../db/schema';
import { hashApiKey } from '../utils/hash';
import { eq, and } from 'drizzle-orm';

declare module 'fastify' {
  interface FastifyRequest {
    apiKeyId?: string;
    userId?: string;
    userPlan?: string;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing API key' });
  }

  const key = authHeader.replace('Bearer ', '').trim();
  if (!key.startsWith('wi_')) {
    return reply.status(401).send({ error: 'Invalid API key format' });
  }

  const hash = hashApiKey(key);

  const [keyRow] = await db
    .select({ id: apiKeys.id, userId: apiKeys.userId, revoked: apiKeys.revoked, plan: users.plan })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.revoked, false)))
    .limit(1);

  if (!keyRow) {
    return reply.status(401).send({ error: 'Invalid or revoked API key' });
  }

  db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyRow.id)).catch(() => {});

  request.apiKeyId = keyRow.id!;
  request.userId = keyRow.userId!;
  request.userPlan = keyRow.plan!;
}
