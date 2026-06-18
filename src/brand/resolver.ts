import { db } from '../db/client';
import { brandCache } from '../db/schema';
import { eq } from 'drizzle-orm';
import { fetchBrand } from './fetcher';

export async function resolveBrand(domain: string) {
  const [cached] = await db.select().from(brandCache).where(eq(brandCache.domain, domain)).limit(1);
  if (cached && cached.expiresAt && new Date(cached.expiresAt) > new Date()) return cached;

  const fresh = await fetchBrand(domain);
  const insertData: typeof brandCache.$inferInsert = { domain, ...fresh, fetchedAt: new Date() };
  await db.insert(brandCache).values(insertData)
    .onConflictDoUpdate({ target: brandCache.domain, set: { ...fresh, fetchedAt: new Date() } });

  const [result] = await db.select().from(brandCache).where(eq(brandCache.domain, domain)).limit(1);
  return result;
}
