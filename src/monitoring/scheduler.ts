import cron from 'node-cron';
import { db } from '../db/client';
import { monitors } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { getMonitorQueue } from '../queue/setup';

const INTERVALS: Record<string, string> = {
  hourly: '0 * * * *',
  daily: '30 2 * * *',
  weekly: '30 2 * * 1',
};

async function enqueueMonitors(interval: string) {
  const activeMonitors = await db.select().from(monitors).where(
    and(eq(monitors.active, true), eq(monitors.checkInterval, interval))
  );
  const queue = getMonitorQueue();
  for (const monitor of activeMonitors) {
    const urls = (monitor.urls as string[]) || [];
    const url = urls[0] || '';
    await queue.add('monitor', { monitorId: monitor.id, url }, {
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}

export function startMonitorScheduler() {
  for (const [interval, cronExpr] of Object.entries(INTERVALS)) {
    const valid = cron.validate(cronExpr);
    if (!valid) {
      console.error(`Invalid cron expression for ${interval}: ${cronExpr}`);
      continue;
    }
    cron.schedule(cronExpr, () => {
      console.log(`Running ${interval} monitor checks...`);
      enqueueMonitors(interval).catch(err => {
        console.error(`Monitor scheduler (${interval}) error:`, err);
      });
    });
  }
  console.log('Monitor scheduler started');
}
