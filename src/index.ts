import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';

let Sentry: any;
try {
  Sentry = require('@sentry/node');
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: config.NODE_ENV, tracesSampleRate: 0.1 });
  console.log('[sentry] Error tracking enabled');
} catch {
  console.log('[sentry] Not installed — skipping (npm install @sentry/node)');
}

import { authRoutes } from './routes/auth';
import { usageRoutes } from './routes/usage';
import { webRoutes } from './routes/web';
import { brandRoutes } from './routes/brand';
import { intelRoutes } from './routes/intel';
import { monitorRoutes } from './routes/monitor';
import { reportsRoutes } from './routes/reports';
import { billingRoutes } from './routes/billing';
import { versionRoutes } from './routes/version';
import { contractRoutes } from './routes/contracts';
import { sessionRoutes } from './routes/session';
import { pageRoutes } from './routes/pages';
import { setupQueues, connection, getIntelQueue, getCrawlQueue, getMonitorQueue, getBrandQueue } from './queue/setup';
import { startMonitorScheduler, stopMonitorScheduler } from './monitoring/scheduler';
import { startExtractionScheduler, stopExtractionScheduler } from './extraction/scheduler';
import { runExtractionJob } from './queue/workers/extractionWorker';
import { startCrawlWorker } from './queue/workers/crawlWorker';
import { startIntelWorker } from './queue/workers/intelWorker';
import { startMonitorWorker } from './queue/workers/monitorWorker';
import { setupRequestLogger } from './middleware/requestLogger';
import { resolveBrand } from './brand/resolver';
import { db } from './db/client';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { sanitizeError } from './utils/errors';

const app = Fastify({ logger: true, genReqId: () => crypto.randomUUID() });

async function runMigrations() {
  try {
    await db.execute(sql`SELECT 1`);
    console.log('[migrations] Database connected. Running migrations via drizzle-kit migrate...');
    console.log('[migrations] Run `npm run db:migrate` before deploy to apply schema changes.');
  } catch (err) {
    console.error('[migrations] Database connection failed:', err);
  }
}

async function healthCheckDB(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

async function healthCheckRedis(): Promise<boolean> {
  try {
    return (await connection.ping()) === 'PONG';
  } catch {
    return false;
  }
}

async function healthCheckSidecar(): Promise<boolean> {
  try {
    const res = await fetch(`${config.CRAWL4AI_SIDECAR_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function bootstrap() {
  await runMigrations();

  // Correlation ID header on every response
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
  });

  // Global error handler — last line of defense for uncaught errors
  app.setErrorHandler((err, _request, reply) => {
    const error = err as { statusCode?: number; message: string };
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? sanitizeError(error) : error.message;
    app.log.error({ err: error, requestId: _request.id }, 'Unhandled error');
    if (Sentry && statusCode === 500) {
      Sentry.captureException(err, { extra: { requestId: _request.id, url: _request.url } });
    }
    reply.status(statusCode).send({
      error: message,
      requestId: _request.id,
    });
  });

  const corsOrigins = config.CORS_ORIGINS === '*'
    ? true
    : config.CORS_ORIGINS.split(',').map(s => s.trim());

  await app.register(cors, { origin: corsOrigins });

  setupRequestLogger(app);

  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(usageRoutes, { prefix: '/v1' });
  await app.register(webRoutes, { prefix: '/v1/web' });
  await app.register(brandRoutes, { prefix: '/v1/brand' });
  await app.register(intelRoutes, { prefix: '/v1/intel' });
  await app.register(monitorRoutes, { prefix: '/v1/monitor' });
  await app.register(reportsRoutes, { prefix: '/v1/reports' });
  await app.register(versionRoutes, { prefix: '/v1/versions' });
  await app.register(contractRoutes, { prefix: '/v1/contracts' });
  await app.register(sessionRoutes, { prefix: '/v1' });
  await app.register(billingRoutes, { prefix: '/v1/billing' });

  // Liveness check — returns 200 if process is running
  app.get('/health', async () => ({ status: 'ok', ts: Date.now() }));

  // Readiness check — probes all dependencies
  app.get('/ready', async () => {
    const [dbOk, redisOk, sidecarOk] = await Promise.all([
      healthCheckDB(),
      healthCheckRedis(),
      healthCheckSidecar(),
    ]);

    const allOk = dbOk && redisOk && sidecarOk;

    return {
      status: allOk ? 'ready' : 'degraded',
      checks: {
        database: dbOk ? 'ok' : 'down',
        redis: redisOk ? 'ok' : 'down',
        sidecar: sidecarOk ? 'ok' : 'down',
      },
    };
  });

  app.get('/live', async () => ({ status: 'alive', ts: Date.now(), uptime: process.uptime() }));

  await app.register(pageRoutes);

  app.get('/v1/logo/:domain', async (req, reply) => {
    try {
      const { domain } = req.params as { domain: string };
      const brand = await resolveBrand(domain);
      if (!brand || !brand.logoUrl) return reply.status(404).send({ error: 'Logo not found' });
      return reply.redirect(brand.logoUrl);
    } catch { return reply.status(404).send({ error: 'Logo not found' }); }
  });

  await setupQueues();
  startIntelWorker();
  startCrawlWorker();
  startMonitorWorker();
  startMonitorScheduler();
  startExtractionScheduler(runExtractionJob);

  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  console.log(`WebIntel API running on port ${config.PORT}`);
}

bootstrap().catch(err => { console.error(err); process.exit(1); });

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  try {
    stopMonitorScheduler();
    stopExtractionScheduler();
    await app.close();
    const queues = [getIntelQueue(), getCrawlQueue(), getMonitorQueue(), getBrandQueue()];
    await Promise.allSettled(queues.map(q => q.close()));
    await connection.quit();
  } catch (err) {
    console.error('Shutdown error:', err);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
