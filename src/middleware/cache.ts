import { FastifyRequest, FastifyReply } from 'fastify';
import { connection } from '../queue/setup';
import crypto from 'crypto';

export function responseCache(ttlSeconds: number) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method !== 'POST' && request.method !== 'GET') return;

    const cacheKey = `cache:${request.method}:${request.url}:${crypto.createHash('md5').update(JSON.stringify(request.body ?? request.query)).digest('hex')}`;
    const cached = await connection.get(cacheKey);
    if (cached) {
      return reply.header('X-Cache', 'HIT').send({ ...JSON.parse(cached), cached: true });
    }

    const originalSend = reply.send.bind(reply);
    (reply as any).send = async (payload: unknown) => {
      if (reply.statusCode === 200 && payload) {
        await connection.setex(cacheKey, ttlSeconds, JSON.stringify(payload)).catch(() => {});
      }
      return originalSend(payload);
    };
  };
}
