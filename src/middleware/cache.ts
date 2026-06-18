import { FastifyRequest, FastifyReply } from 'fastify';
import { connection } from '../queue/setup';
import crypto from 'crypto';

export function responseCache(ttlSeconds: number, methods: string[] = ['GET']) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!methods.includes(request.method)) return;

    const bodyHash = request.body ? crypto.createHash('md5').update(JSON.stringify(request.body)).digest('hex') : '';
    const cacheKey = `cache:${request.method}:${request.url}:${bodyHash}`;
    const cached = await connection.get(cacheKey);
    if (cached) {
      return reply.header('X-Cache', 'HIT').send({ ...JSON.parse(cached), cached: true });
    }

    const originalSend = reply.send.bind(reply);
    reply.send = function (payload: unknown) {
      if (reply.statusCode === 200 && payload) {
        connection.setex(cacheKey, ttlSeconds, JSON.stringify(payload)).catch((err: unknown) => console.error('Failed to set cache:', err));
      }
      return originalSend(payload);
    } as typeof reply.send;
  };
}
