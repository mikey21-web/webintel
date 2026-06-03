import { Job } from 'bullmq';
import { config } from '../../config';
import { db } from '../../db/client';
import { intelJobs } from '../../db/schema';
import { eq } from 'drizzle-orm';

export async function processCrawlJob(job: Job) {
  const { jobId, url } = job.data;
  const sidecarUrl = config.CRAWL4AI_SIDECAR_URL;

  await db.update(intelJobs).set({ status: 'crawling' }).where(eq(intelJobs.id, jobId));

  const response = await fetch(`${sidecarUrl}/crawl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, stream: true }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.body) throw new Error('No response body from sidecar');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let totalChunks = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        totalChunks++;
        if (job.data.progressCallback) {
          await job.updateProgress(Math.round((totalChunks / 100) * 100));
        }
        if (data.type === 'error') {
          throw new Error(data.message);
        }
      } catch { /* skip invalid JSON lines */ }
    }
  }
}
