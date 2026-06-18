import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { apiKeys, users, creditBalances } from '../db/schema';
import { hashApiKey, generateApiKey } from '../utils/hash';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { verify as verifyJwt, createScopedToken } from '../utils/jwt';
import { rateLimit } from '../middleware/rateLimit';
import { sanitizeError } from '../utils/errors';
import { z } from 'zod';

const signupSchema = z.object({ email: z.string().email() });

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: z.infer<typeof signupSchema> }>('/signup', { preHandler: [rateLimit()] }, async (request, reply) => {
    try {
      const parsed = signupSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Valid email is required' });
      const { email } = parsed.data;

      let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        [user] = await db.insert(users).values({ email, plan: 'pro' }).returning();
        await db.insert(creditBalances).values({
          userId: user.id,
          creditsRemaining: 500,
          creditsUsedCycle: 0,
        } as any).onConflictDoUpdate({
          target: creditBalances.userId,
          set: { creditsRemaining: sql`${creditBalances.creditsRemaining} + 500` },
        });
      }

      const raw = generateApiKey();
      const hash = hashApiKey(raw);
      await db.insert(apiKeys).values({
        userId: user.id,
        keyHash: hash,
        keyPrefix: raw.slice(0, 10),
        name: 'Default',
      });

      return reply.status(201).send({
        apiKey: raw,
        plan: user.plan,
        message: 'Welcome to WebIntel! Save your API key — it won\'t be shown again.',
      });
    } catch (err: any) {
      return reply.status(500).send({ error: sanitizeError(err) });
    }
  });

  app.post<{ Body: { name?: string } }>('/keys', { preHandler: [requireAuth, rateLimit()] }, async (request, reply) => {
    try {
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
    } catch (err: any) {
      return reply.status(500).send({ error: sanitizeError(err) });
    }
  });

  app.get('/keys', { preHandler: [rateLimit()] }, async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing API key' });
      }
      const key = authHeader.replace('Bearer ', '').trim();
      const hash = hashApiKey(key);

      const [keyRow] = await db
        .select({ id: apiKeys.id, userId: apiKeys.userId, revoked: apiKeys.revoked })
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, hash))
        .limit(1);
      if (!keyRow) return reply.status(401).send({ error: 'Invalid API key' });
      if (keyRow.revoked) return reply.status(401).send({ error: 'API key has been revoked' });

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
    } catch (err: any) {
      return reply.status(500).send({ error: sanitizeError(err) });
    }
  });

  app.delete<{ Params: { id: string } }>('/keys/:id', { preHandler: [rateLimit()] }, async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing API key' });
      }
      const key = authHeader.replace('Bearer ', '').trim();
      const hash = hashApiKey(key);

      const [authKey] = await db
        .select({ userId: apiKeys.userId, revoked: apiKeys.revoked })
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, hash))
        .limit(1);
      if (!authKey) return reply.status(401).send({ error: 'Invalid API key' });
      if (authKey.revoked) return reply.status(401).send({ error: 'API key has been revoked' });

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
    } catch (err: any) {
      return reply.status(500).send({ error: sanitizeError(err) });
    }
  });

  app.post('/login', { preHandler: [rateLimit()] }, async (request, reply) => {
    try {
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
    } catch (err: any) {
      return reply.status(500).send({ error: sanitizeError(err) });
    }
  });

  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({
      userId: request.userId,
      userPlan: request.userPlan,
      authMethod: request.authMethod,
    });
  });
}
