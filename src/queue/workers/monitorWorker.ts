import { Job } from 'bullmq';
import { db } from '../../db/client';
import { monitors, monitorAlerts, monitorSnapshots } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { scrapeUrl } from '../../scraping';
import { hashContent, diffContent, classifyChange } from '../../monitoring/differ';
import { dispatchAlert } from '../../monitoring/alerter';

export async function processMonitorJob(job: Job) {
  const { monitorId, url } = job.data;
  const [monitor] = await db.select().from(monitors).where(eq(monitors.id, monitorId));
  if (!monitor || !monitor.active) return;
  const page = await scrapeUrl(url);
  const newHash = hashContent(page.text);

  const [lastSnapshot] = await db.select().from(monitorSnapshots)
    .where(eq(monitorSnapshots.monitorId, monitorId))
    .orderBy(monitorSnapshots.capturedAt)
    .limit(1);

  const oldHash = lastSnapshot?.contentHash;

  if (oldHash && newHash !== oldHash) {
    const [alert] = await db.insert(monitorAlerts).values({
      monitorId: monitor.id,
      url,
      diffSummary: 'Content changed',
      diffDetail: { detected: true },
      severity: 'medium',
    } as any).returning();

    await (dispatchAlert as any)(alert, monitor);
  }

  await db.insert(monitorSnapshots).values({
    monitorId,
    url,
    contentHash: newHash,
    content: page.text,
  }).onConflictDoNothing();

  await db.update(monitors).set({ lastCheckedAt: new Date() }).where(eq(monitors.id, monitorId));
}
