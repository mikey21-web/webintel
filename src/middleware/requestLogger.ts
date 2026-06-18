import { FastifyInstance } from 'fastify';

export function setupRequestLogger(app: FastifyInstance) {
  app.addHook('onResponse', async (request, reply) => {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      method: request.method,
      url: request.url,
      status: reply.statusCode,
      duration: reply.elapsedTime ?? 0,
      apiKeyId: request.apiKeyId || 'anon',
      userId: request.userId || 'anon',
    }));
  });
}
