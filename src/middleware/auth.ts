import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client';
import { apiKeys, users } from '../db/schema';
import { hashApiKey } from '../utils/hash';
import { verify as verifyJwt, isAnonKey } from '../utils/jwt';
import { eq, and } from 'drizzle-orm';

declare module 'fastify' {
  interface FastifyRequest {
    apiKeyId?: string;
    userId?: string;
    userPlan?: string;
    authMethod?: 'jwt' | 'apikey';
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header. Use: Bearer <token>' });
  }

  const token = authHeader.replace('Bearer ', '').trim();

  if (isAnonKey(token)) {
    return reply.status(401).send({ error: 'Use a user JWT or API key, not the anon key' });
  }

  if (token.startsWith('wi_')) {
    const hash = hashApiKey(token);
    const [keyRow] = await db
      .select({ id: apiKeys.id, userId: apiKeys.userId, revoked: apiKeys.revoked, plan: users.plan })
      .from(apiKeys)
      .innerJoin(users, eq(apiKeys.userId, users.id))
      .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.revoked, false)))
      .limit(1);

    if (!keyRow) {
      return reply.status(401).send({ error: 'Invalid or revoked API key' });
    }

    db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyRow.id)).catch((err) => console.error('Failed to update lastUsedAt:', err));

    request.apiKeyId = keyRow.id!;
    request.userId = keyRow.userId!;
    request.userPlan = keyRow.plan!;
    request.authMethod = 'apikey';
    return;
  }

  const jwtPayload = await verifyJwt(token);
  if (!jwtPayload || !jwtPayload.sub) {
    return reply.status(401).send({ error: 'Invalid or expired JWT' });
  }

  request.userId = jwtPayload.sub;
  request.authMethod = 'jwt';

  const [jwtKeyRow] = await db
    .select({ id: apiKeys.id, plan: users.plan })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.userId, jwtPayload.sub), eq(apiKeys.revoked, false)))
    .limit(1);

  if (jwtKeyRow) {
    request.apiKeyId = jwtKeyRow.id!;
    request.userPlan = jwtKeyRow.plan!;
  } else {
    request.userPlan = 'pro';
  }
}
