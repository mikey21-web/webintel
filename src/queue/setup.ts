import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';

const redisUrl = config.REDIS_URL;
const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  tls: redisUrl.startsWith('rediss://') ? {} : undefined,
});
export const connection = redis as any;

export function getIntelQueue() {
  return new Queue('intel', { connection });
}

export function getCrawlQueue() {
  return new Queue('crawl', { connection });
}

export function getMonitorQueue() {
  return new Queue('monitor', { connection });
}

export function getBrandQueue() {
  return new Queue('brand', { connection });
}

export async function setupQueues() {
  await redis.ping();
  console.log('Redis queues connected');
}
