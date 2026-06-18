import { Worker } from 'bullmq';
import { connection } from '../setup';
import { db } from '../../db/client';
import { crawlJobs } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { sidecarScrape } from '../../scraping/sidecar';

export function startCrawlWorker() {
  const worker = new Worker('crawl', async (job) => {
    const { jobId, url, maxPages, apiKeyId } = job.data;
    
    await db.update(crawlJobs).set({ status: 'running' }).where(eq(crawlJobs.id, jobId));
    
    try {
      // Simple crawling: scrape main page + discover links
      const result = await sidecarScrape(url, { useJs: true, waitFor: 3000 });
      
      // Extract links from markdown for additional pages
      const linkRegex = /https?:\/\/[^\s"'<>)]+/g;
      const links = (result.markdown.match(linkRegex) || [])
        .map((l: string) => l.replace(/[.,;:!?)]+$/, ''))
        .filter((l: string) => l.startsWith(new URL(url).origin))
        .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
        .slice(0, Math.max(0, maxPages - 1));
      
      // Scrape discovered pages (limit concurrency)
      const pages: Array<{ url: string; markdown: string }> = [{ url, markdown: result.markdown }];
      
      const batchSize = 3;
      for (let i = 0; i < links.length; i += batchSize) {
        const batch = links.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((link: string) => sidecarScrape(link, { useJs: false }).then(r => ({ url: link, markdown: r.markdown })))
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) pages.push(r.value);
        }
      }
      
      await db.update(crawlJobs).set({
        status: 'done',
        pagesCrawled: pages.length,
        pagesFound: links.length + 1,
        result: { pages, combinedMarkdown: pages.map(p => p.markdown).join('\n\n') },
        completedAt: new Date(),
      }).where(eq(crawlJobs.id, jobId));
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.error(`Crawl worker error for job ${jobId}:`, errorMsg);
      await db.update(crawlJobs).set({
        status: 'failed',
        error: errorMsg,
        completedAt: new Date(),
      }).where(eq(crawlJobs.id, jobId));
    }
  }, { connection, concurrency: 3 });
  
  console.log('Crawl worker started');
  return worker;
}
