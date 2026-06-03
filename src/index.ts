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
import { setupQueues } from './queue/setup';
import { startMonitorScheduler } from './monitoring/scheduler';
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
  startMonitorScheduler();

  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  console.log(`WebIntel API running on port ${config.PORT}`);
}

bootstrap().catch(err => { console.error(err); process.exit(1); });
