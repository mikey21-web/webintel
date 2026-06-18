import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';

const redisUrl = config.REDIS_URL;
const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  tls: redisUrl.startsWith('rediss://') ? {} : undefined,
});

export const connection = redis as any;

export const intelQueue = new Queue('intel', { connection });
export const crawlQueue = new Queue('crawl', { connection });
export const monitorQueue = new Queue('monitor', { connection });
export const brandQueue = new Queue('brand', { connection });

export function getIntelQueue() { return intelQueue; }
export function getCrawlQueue() { return crawlQueue; }
export function getMonitorQueue() { return monitorQueue; }
export function getBrandQueue() { return brandQueue; }

export async function setupQueues() {
  await redis.ping();
  console.log('Redis queues connected');
}
