import { FastifyRequest, FastifyReply } from 'fastify';
import { connection } from '../queue/setup';
import crypto from 'crypto';

export function responseCache(ttlSeconds: number) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method !== 'GET') return;

    const cacheKey = `cache:${request.method}:${request.url}`;
    const cached = await connection.get(cacheKey);
    if (cached) {
      return reply.header('X-Cache', 'HIT').send({ ...JSON.parse(cached), cached: true });
    }

    const originalSend = reply.send.bind(reply);
    reply.send = function (payload: unknown) {
      if (reply.statusCode === 200 && payload) {
        connection.setex(cacheKey, ttlSeconds, JSON.stringify(payload)).catch(() => {});
      }
      return originalSend(payload);
    } as typeof reply.send;
  };
}
