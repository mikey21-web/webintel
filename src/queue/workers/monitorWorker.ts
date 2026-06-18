import { Worker } from 'bullmq';
import { connection } from '../setup';
import { db } from '../../db/client';
import { monitors, monitorSnapshots, monitorAlerts } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { sidecarScrape } from '../../scraping/sidecar';
import { hashContent, diffContent, classifyChange } from '../../monitoring/differ';
import { dispatchAlert } from '../../monitoring/alerter';

export function startMonitorWorker() {
  const worker = new Worker('monitor', async (job) => {
    const { monitorId, url } = job.data;
    
    try {
      // Scrape current content
      const result = await sidecarScrape(url, { useJs: true });
      const currentHash = hashContent(result.markdown);
      
      // Get last snapshot
      const [lastSnapshot] = await db.select()
        .from(monitorSnapshots)
        .where(eq(monitorSnapshots.url, url))
        .orderBy(desc(monitorSnapshots.capturedAt))
        .limit(1);
      
      if (lastSnapshot && lastSnapshot.contentHash !== currentHash) {
        // Content changed!
        const diff = diffContent(lastSnapshot.content, result.markdown);
        const classification = await classifyChange(diff, url);
        
        // Save new snapshot
        await db.insert(monitorSnapshots).values({
          monitorId,
          url,
          contentHash: currentHash,
          content: result.markdown,
        });
        
        // Create alert
        const [alert] = await db.insert(monitorAlerts).values({
          monitorId,
          url,
          diffSummary: classification.summary,
          diffDetail: classification as any,
          severity: classification.severity,
        }).returning();
        
        // Dispatch alert
        const [monitor] = await db.select().from(monitors).where(eq(monitors.id, monitorId)).limit(1);
        if (monitor) {
          await dispatchAlert({
            id: alert.id,
            monitorId,
            summary: classification.summary,
            severity: classification.severity,
            changes: classification,
            diff,
          }, monitor);
        }
      } else if (!lastSnapshot) {
        // First snapshot
        await db.insert(monitorSnapshots).values({
          monitorId,
          url,
          contentHash: currentHash,
          content: result.markdown,
        });
      }
      
      await db.update(monitors).set({ lastCheckedAt: new Date() }).where(eq(monitors.id, monitorId));
    } catch (err) {
      console.error(`Monitor worker error for monitor ${monitorId}:`, (err as Error).message);
      throw err;
    }
  }, { connection, concurrency: 3 });
  
  console.log('Monitor worker started');
  return worker;
}
