import { eq, and } from 'drizzle-orm';
import { db } from '../db/client';
import { extractionContracts } from '../db/schema';

const INTERVALS: Record<string, string> = {
  hourly: '0 * * * *',
  daily: '30 2 * * *',
  weekly: '30 2 * * 1',
};

type ScheduleInterval = 'hourly' | 'daily' | 'weekly';

const _jobs: Map<string, { stop: () => void }> = new Map();

export async function enqueueScheduledContracts(
  interval: ScheduleInterval,
  enqueueFn: (contractId: string, url: string, webhookUrl: string | null) => Promise<void>,
): Promise<void> {
  const contracts = await db
    .select()
    .from(extractionContracts)
    .where(
      and(
        eq(extractionContracts.active, true),
        eq(extractionContracts.schedule, interval),
      ),
    );

  for (const contract of contracts) {
    try {
      await enqueueFn(contract.id, contract.url, contract.webhookUrl);
    } catch {
      // Skip failed enqueue, continue with others
    }
  }
}

export function startExtractionScheduler(
  enqueueFn: (contractId: string, url: string, webhookUrl: string | null) => Promise<void>,
): void {
  for (const [interval, cronExpr] of Object.entries(INTERVALS)) {
    // Use a simple interval-based approach instead of node-cron dependency
    const scheduleInterval = interval as ScheduleInterval;
    const ms = interval === 'hourly' ? 3600000 : interval === 'daily' ? 86400000 : 604800000;

    const timer = setInterval(() => {
      enqueueScheduledContracts(scheduleInterval, enqueueFn).catch(() => {});
    }, ms);

    _jobs.set(interval, { stop: () => clearInterval(timer) });

    // Run once immediately on startup
    enqueueScheduledContracts(scheduleInterval, enqueueFn).catch(() => {});
  }
}

export function stopExtractionScheduler(): void {
  for (const [, job] of _jobs) {
    job.stop();
  }
  _jobs.clear();
}
