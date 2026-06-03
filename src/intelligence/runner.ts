import { db } from '../db/client';
import { intelJobs } from '../db/schema';
import { eq } from 'drizzle-orm';
import { runCompetitorIntel } from './modules/competitor';
import { runMarketMap } from './modules/marketMap';
import { runLeadIntel } from './modules/leadIntel';
import { runSalesBrief } from './modules/salesBrief';
import { runPricingIntel } from './modules/pricingIntel';
import { runTechStackIntel } from './modules/techStack';
import { runCompare } from './modules/compare';
import { runEnrich } from './modules/enrich';
import crypto from 'crypto';

async function deliverWebhook(url: string, payload: any, jobId: string) {
  const signature = crypto.createHmac('sha256', 'webintel-webhook-secret').update(JSON.stringify(payload)).digest('hex');
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-WebIntel-Signature': signature, 'X-WebIntel-JobId': jobId },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        await db.update(intelJobs).set({ webhookStatus: 'delivered' }).where(eq(intelJobs.id, jobId));
        return;
      }
    } catch {}
    if (i < 2) await new Promise(r => setTimeout(r, [5000, 25000, 125000][i]));
  }
  await db.update(intelJobs).set({ webhookStatus: 'failed' }).where(eq(intelJobs.id, jobId));
}

export async function runIntelJob(jobId: string, module: string, input: Record<string, any>) {
  const { webhookUrl, ...cleanInput } = input;
  await db.update(intelJobs).set({ status: 'running', startedAt: new Date() }).where(eq(intelJobs.id, jobId));
  try {
    let result: unknown;
    switch (module) {
      case 'competitor': result = await runCompetitorIntel(cleanInput.domain, cleanInput.depth); break;
      case 'market_map': result = await runMarketMap(cleanInput.keyword, cleanInput.location, cleanInput.limit); break;
      case 'lead_intel': result = await runLeadIntel(cleanInput.domains, cleanInput.context); break;
      case 'sales_brief': result = await runSalesBrief(cleanInput.targetDomain, cleanInput.yourProduct, cleanInput.yourDomain); break;
      case 'pricing_intel': result = await runPricingIntel(cleanInput.domain); break;
      case 'tech_stack': result = await runTechStackIntel(cleanInput.domain); break;
      case 'compare': result = await runCompare(cleanInput.domains); break;
      case 'enrich': result = await runEnrich(cleanInput.domain); break;
      default: throw new Error(`Unknown module: ${module}`);
    }
    await db.update(intelJobs).set({ status: 'done', result: result as any, completedAt: new Date() }).where(eq(intelJobs.id, jobId));
    if (webhookUrl) {
      await deliverWebhook(webhookUrl, { jobId, status: 'done', result }, jobId);
    }
  } catch (err) {
    const errorMsg = (err as Error).message;
    await db.update(intelJobs).set({ status: 'failed', error: errorMsg, completedAt: new Date() }).where(eq(intelJobs.id, jobId));
    if (webhookUrl) {
      await deliverWebhook(webhookUrl, { jobId, status: 'failed', error: errorMsg }, jobId);
    }
  }
}
