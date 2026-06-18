import { Worker } from 'bullmq';
import { connection } from '../setup';
import { resolveBrand } from '../../brand/resolver';

export function startBrandWorker() {
  const worker = new Worker('brand', async (job) => {
    try {
      const { domain } = job.data;
      await resolveBrand(domain);
    } catch (err) {
      console.error(`Brand worker error for job ${job.data.domain}:`, err);
      throw err;
    }
  }, { connection, concurrency: 3 });

  console.log('Brand worker started');
  return worker;
}
