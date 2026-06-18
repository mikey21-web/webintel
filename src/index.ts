import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';
import { authRoutes } from './routes/auth';
import { usageRoutes } from './routes/usage';
import { webRoutes } from './routes/web';
import { brandRoutes } from './routes/brand';
import { intelRoutes } from './routes/intel';
import { monitorRoutes } from './routes/monitor';
import { reportsRoutes } from './routes/reports';
import { setupQueues, connection, getIntelQueue, getCrawlQueue, getMonitorQueue, getBrandQueue } from './queue/setup';
import { startMonitorScheduler } from './monitoring/scheduler';
import { startCrawlWorker } from './queue/workers/crawlWorker';
import { startIntelWorker } from './queue/workers/intelWorker';
import { startMonitorWorker } from './queue/workers/monitorWorker';
import { setupRequestLogger } from './middleware/requestLogger';

const app = Fastify({ logger: true });

async function bootstrap() {
  await app.register(cors, { origin: true });

  setupRequestLogger(app);

  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(usageRoutes, { prefix: '/v1' });
  await app.register(webRoutes, { prefix: '/v1/web' });
  await app.register(brandRoutes, { prefix: '/v1/brand' });
  await app.register(intelRoutes, { prefix: '/v1/intel' });
  await app.register(monitorRoutes, { prefix: '/v1/monitor' });
  await app.register(reportsRoutes, { prefix: '/v1/reports' });

  app.get('/health', async () => ({ status: 'ok', ts: Date.now() }));

  await setupQueues();
  startIntelWorker();
  startCrawlWorker();
  startMonitorWorker();
  startMonitorScheduler();

  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  console.log(`WebIntel API running on port ${config.PORT}`);
}

bootstrap().catch(err => { console.error(err); process.exit(1); });

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  try {
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
