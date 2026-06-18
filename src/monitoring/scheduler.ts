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

const scheduledTasks: cron.ScheduledTask[] = [];

async function enqueueMonitors(interval: string) {
  const activeMonitors = await db.select().from(monitors).where(
    and(eq(monitors.active, true), eq(monitors.checkInterval, interval))
  );
  const queue = getMonitorQueue();
  for (const monitor of activeMonitors) {
    const urls = (monitor.urls as string[]) || [];
    if (urls.length === 0) continue;
    const url = urls[0];
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
    const task = cron.schedule(cronExpr, () => {
      console.log(`Running ${interval} monitor checks...`);
      enqueueMonitors(interval).catch(err => {
        console.error(`Monitor scheduler (${interval}) error:`, err);
      });
    });
    scheduledTasks.push(task);
  }
  console.log('Monitor scheduler started');
}

export function stopMonitorScheduler() {
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks.length = 0;
  console.log('Monitor scheduler stopped');
}
