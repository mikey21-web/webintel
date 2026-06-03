import { FastifyRequest, FastifyReply } from 'fastify';
import { connection } from '../queue/setup';

const PLAN_LIMITS: Record<string, number> = { free: 30, starter: 120, pro: 300, scale: 1200 };

export function rateLimit() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.apiKeyId) return;
    const plan = request.userPlan ?? 'free';
    const limit = PLAN_LIMITS[plan] ?? 30;
    const key = `rl:${request.apiKeyId}`;
    const current = await connection.incr(key);
    if (current === 1) await connection.expire(key, 60);

    reply.header('X-RateLimit-Limit', limit);
    reply.header('X-RateLimit-Remaining', Math.max(0, limit - current));

    if (current > limit) {
      return reply.status(429).send({ error: 'Rate limit exceeded', retryAfter: await connection.ttl(key) });
    }
  };
}
