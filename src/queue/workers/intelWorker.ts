import { Worker } from 'bullmq';
import { connection } from '../setup';
import { runIntelJob } from '../../intelligence/runner';

export function startIntelWorker() {
  const worker = new Worker('intel', async (job) => {
    try {
      const { jobId, module, input, webhookUrl } = job.data;
      if (webhookUrl) input.webhookUrl = webhookUrl;
      await runIntelJob(jobId, module, input);
    } catch (err) {
      console.error(`Intel worker error for job ${job.data.jobId}:`, err);
      throw err;
    }
  }, { connection, concurrency: 5 });
  
  console.log('Intel worker started');
  return worker;
}
