import { Worker, Job } from 'bullmq';
import { config } from '../../config';
import { runIntelJob } from '../../intelligence/runner';

const connection = { url: config.REDIS_URL };

const worker = new Worker('intel', async (job: Job) => {
  const { jobId, module, input } = job.data;
  await runIntelJob(jobId, module, input);
}, { connection, concurrency: 3, limiter: { max: 10, duration: 60000 } });

worker.on('failed', (job, err) => {
  console.error(`Intel worker: job ${job?.id} failed:`, err.message);
});

worker.on('completed', job => {
  console.log(`Intel worker: job ${job.id} completed`);
});

export default worker;
