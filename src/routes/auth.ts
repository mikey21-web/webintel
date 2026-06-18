import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { apiKeys, users } from '../db/schema';
import { hashApiKey, generateApiKey } from '../utils/hash';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { verify as verifyJwt, createScopedToken } from '../utils/jwt';

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { name?: string } }>('/keys', { preHandler: requireAuth }, async (request, reply) => {
    const [user] = await db.select().from(users).where(eq(users.id, request.userId!)).limit(1);
    if (!user) return reply.status(401).send({ error: 'User not found' });

    const raw = generateApiKey();
    const hash = hashApiKey(raw);
    const prefix = raw.slice(0, 10);
    const keyName = request.body?.name || 'Default';
    const [keyRow] = await db.insert(apiKeys).values({ userId: user.id, keyHash: hash, keyPrefix: prefix, name: keyName }).returning();

    return reply.status(201).send({
      apiKey: raw,
      keyId: keyRow.id,
      user: { id: user.id, email: user.email, plan: user.plan },
      message: 'Save this API key — it will not be shown again',
    });
  });

  app.get('/keys', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing API key' });
    }
    const key = authHeader.replace('Bearer ', '').trim();
    const hash = hashApiKey(key);

    const [keyRow] = await db
      .select({ id: apiKeys.id, userId: apiKeys.userId })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, hash))
      .limit(1);
    if (!keyRow) return reply.status(401).send({ error: 'Invalid API key' });

    const rows = await db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
        revoked: apiKeys.revoked,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, keyRow.userId))
      .orderBy(apiKeys.createdAt);

    return reply.send({ keys: rows });
  });

  app.delete<{ Params: { id: string } }>('/keys/:id', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing API key' });
    }
    const key = authHeader.replace('Bearer ', '').trim();
    const hash = hashApiKey(key);

    const [authKey] = await db
      .select({ userId: apiKeys.userId })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, hash))
      .limit(1);
    if (!authKey) return reply.status(401).send({ error: 'Invalid API key' });

    const [target] = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(and(
        eq(apiKeys.id, request.params.id),
        eq(apiKeys.userId, authKey.userId)
      ))
      .limit(1);
    if (!target) return reply.status(404).send({ error: 'API key not found' });

    await db.update(apiKeys).set({ revoked: true }).where(eq(apiKeys.id, request.params.id));

    return reply.send({ message: 'API key revoked' });
  });

  app.post('/login', async (request, reply) => {
    const { access_token } = request.body as { access_token?: string };
    if (!access_token) {
      return reply.status(400).send({ error: 'access_token is required' });
    }

    const payload = await verifyJwt(access_token);
    if (!payload || !payload.sub) {
      return reply.status(401).send({ error: 'Invalid Supabase session token' });
    }

    const email = payload.email || '';
    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      [user] = await db.insert(users).values({ email, plan: 'pro' }).returning();
    }

    const scoped = await createScopedToken(user.id, email);

    return reply.send({
      token: scoped,
      user: { id: user.id, email: user.email, plan: user.plan },
      expiresIn: '24h',
    });
  });

  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({
      userId: request.userId,
      userPlan: request.userPlan,
      authMethod: request.authMethod,
    });
  });
}
