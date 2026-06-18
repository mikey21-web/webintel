import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { monitorSnapshots, monitorAlerts, monitors } from '../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { diffLines } from 'diff';

export async function versionRoutes(app: FastifyInstance) {
  app.get<{ Params: { monitorId: string } }>(
    '/:monitorId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const snapshots = await db
        .select({
          id: monitorSnapshots.id,
          monitorId: monitorSnapshots.monitorId,
          url: monitorSnapshots.url,
          contentHash: monitorSnapshots.contentHash,
          content: monitorSnapshots.content,
          capturedAt: monitorSnapshots.capturedAt,
        })
        .from(monitorSnapshots)
        .innerJoin(monitors, eq(monitorSnapshots.monitorId, monitors.id))
        .where(and(
          eq(monitorSnapshots.monitorId, request.params.monitorId),
          eq(monitors.userId, request.userId!)
        ))
        .orderBy(desc(monitorSnapshots.capturedAt))
        .limit(50);

      if (!snapshots.length) {
        return reply.status(404).send({ error: 'No versions found for this monitor' });
      }

      return snapshots.map(s => ({
        id: s.id,
        url: s.url,
        contentHash: s.contentHash,
        capturedAt: s.capturedAt,
        contentLength: s.content.length,
      }));
    },
  );

  app.get<{ Params: { monitorId: string; fromId: string; toId: string } }>(
    '/:monitorId/diff/:fromId/:toId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const [fromSnap] = await db
        .select({
          id: monitorSnapshots.id,
          monitorId: monitorSnapshots.monitorId,
          url: monitorSnapshots.url,
          contentHash: monitorSnapshots.contentHash,
          content: monitorSnapshots.content,
          capturedAt: monitorSnapshots.capturedAt,
        })
        .from(monitorSnapshots)
        .innerJoin(monitors, eq(monitorSnapshots.monitorId, monitors.id))
        .where(and(
          eq(monitorSnapshots.id, request.params.fromId),
          eq(monitorSnapshots.monitorId, request.params.monitorId),
          eq(monitors.userId, request.userId!)
        ))
        .limit(1);

      const [toSnap] = await db
        .select({
          id: monitorSnapshots.id,
          monitorId: monitorSnapshots.monitorId,
          url: monitorSnapshots.url,
          contentHash: monitorSnapshots.contentHash,
          content: monitorSnapshots.content,
          capturedAt: monitorSnapshots.capturedAt,
        })
        .from(monitorSnapshots)
        .innerJoin(monitors, eq(monitorSnapshots.monitorId, monitors.id))
        .where(and(
          eq(monitorSnapshots.id, request.params.toId),
          eq(monitorSnapshots.monitorId, request.params.monitorId),
          eq(monitors.userId, request.userId!)
        ))
        .limit(1);

      if (!fromSnap || !toSnap) {
        return reply.status(404).send({ error: 'Snapshot not found' });
      }

      const changes = diffLines(fromSnap.content, toSnap.content);
      const additions = changes.filter(c => c.added).reduce((sum, c) => sum + (c.count || 0), 0);
      const removals = changes.filter(c => c.removed).reduce((sum, c) => sum + (c.count || 0), 0);

      return {
        from: { id: fromSnap.id, capturedAt: fromSnap.capturedAt },
        to: { id: toSnap.id, capturedAt: toSnap.capturedAt },
        stats: { additions, removals, totalChanges: additions + removals },
        changes: changes.map(c => ({
          type: c.added ? 'added' as const : c.removed ? 'removed' as const : 'unchanged' as const,
          value: (c.value || '').slice(0, 500),
          count: c.count,
        })),
      };
    },
  );

  app.get<{ Params: { monitorId: string } }>(
    '/:monitorId/latest',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const snapshots = await db
        .select({
          id: monitorSnapshots.id,
          monitorId: monitorSnapshots.monitorId,
          url: monitorSnapshots.url,
          contentHash: monitorSnapshots.contentHash,
          content: monitorSnapshots.content,
          capturedAt: monitorSnapshots.capturedAt,
        })
        .from(monitorSnapshots)
        .innerJoin(monitors, eq(monitorSnapshots.monitorId, monitors.id))
        .where(and(
          eq(monitorSnapshots.monitorId, request.params.monitorId),
          eq(monitors.userId, request.userId!)
        ))
        .orderBy(desc(monitorSnapshots.capturedAt))
        .limit(2);

      if (!snapshots.length) {
        return reply.status(404).send({ error: 'No versions found' });
      }

      const latest = snapshots[0];
      const previous = snapshots[1];

      let diffResult: any = null;
      if (previous) {
        const priorChanges = diffLines(previous.content, latest.content);
        const additions = priorChanges.filter(c => c.added).reduce((sum, c) => sum + (c.count || 0), 0);
        const removals = priorChanges.filter(c => c.removed).reduce((sum, c) => sum + (c.count || 0), 0);
        diffResult = {
          additions,
          removals,
          totalChanges: additions + removals,
          changes: priorChanges.map(c => ({
            type: c.added ? 'added' as const : c.removed ? 'removed' as const : 'unchanged' as const,
            value: (c.value || '').slice(0, 500),
            count: c.count,
          })),
        };
      }

      return {
        latest: {
          id: latest.id,
          url: latest.url,
          contentHash: latest.contentHash,
          capturedAt: latest.capturedAt,
          contentLength: latest.content.length,
        },
        diff: diffResult,
        versionCount: snapshots.length,
      };
    },
  );

  app.get<{ Params: { monitorId: string } }>(
    '/:monitorId/alerts',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const alerts = await db
        .select({
          id: monitorAlerts.id,
          monitorId: monitorAlerts.monitorId,
          url: monitorAlerts.url,
          diffSummary: monitorAlerts.diffSummary,
          severity: monitorAlerts.severity,
          seen: monitorAlerts.seen,
          createdAt: monitorAlerts.createdAt,
        })
        .from(monitorAlerts)
        .innerJoin(monitors, eq(monitorAlerts.monitorId, monitors.id))
        .where(and(
          eq(monitorAlerts.monitorId, request.params.monitorId),
          eq(monitors.userId, request.userId!)
        ))
        .orderBy(desc(monitorAlerts.createdAt))
        .limit(50);

      return alerts.map(a => ({
        id: a.id,
        url: a.url,
        diffSummary: a.diffSummary,
        severity: a.severity,
        seen: a.seen,
        createdAt: a.createdAt,
      }));
    },
  );

  app.get(
    '/',
    { preHandler: [requireAuth] },
    async (request) => {
      const result = await db.select({
        id: monitors.id,
        name: monitors.name,
        urls: monitors.urls,
        checkInterval: monitors.checkInterval,
        active: monitors.active,
        lastCheckedAt: monitors.lastCheckedAt,
        createdAt: monitors.createdAt,
        versionCount: sql<number>`(SELECT COUNT(*) FROM monitor_snapshots WHERE monitor_id = monitors.id)`,
        lastSnapshotAt: sql<string>`(SELECT MAX(captured_at) FROM monitor_snapshots WHERE monitor_id = monitors.id)`,
      })
        .from(monitors)
        .where(eq(monitors.userId, request.userId!))
        .orderBy(sql`last_snapshot_at DESC NULLS LAST`);

      return result;
    },
  );
}
