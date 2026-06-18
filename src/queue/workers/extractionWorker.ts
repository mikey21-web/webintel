import crypto from 'crypto';
import { db } from '../../db/client';
import { extractionContracts } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { sidecarScrape } from '../../scraping/sidecar';
import { extractWithConfidence } from '../../ai';
import { z } from 'zod';
import type { ContractSchema } from '../../extraction/types';
import { validateContract, healContract } from '../../extraction/contracts';
import { deliverContractWebhook } from '../../extraction/webhooks';

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function contractSchemaToZod(schema: ContractSchema): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};
  for (const [key, def] of Object.entries(schema.fields) as [string, { type: string; description?: string; nullable?: boolean }][]) {
    let f: z.ZodType;
    switch (def.type) {
      case 'string': f = z.string(); break;
      case 'number': f = z.number(); break;
      case 'boolean': f = z.boolean(); break;
      case 'array': f = z.array(z.unknown()); break;
      default: f = z.unknown(); break;
    }
    if (def.nullable !== false) f = f.nullable();
    shape[key] = f;
  }
  return z.object(shape);
}

export async function runExtractionJob(contractId: string, url: string, webhookUrl: string | null): Promise<void> {
  const [contract] = await db
    .select()
    .from(extractionContracts)
    .where(eq(extractionContracts.id, contractId))
    .limit(1);

  if (!contract) return;

  try {
    const result = await sidecarScrape(url, { waitFor: 2000, stealth: true });
    const contentHash = hashContent(result.markdown);

    const contractSchema = contract.schema as ContractSchema;
    const zodSchema = contractSchemaToZod(contractSchema);
    const extraction = await extractWithConfidence(zodSchema, result.markdown);

    const values: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(extraction.fields)) {
      values[key] = field.value;
    }

    const validation = await validateContract(contractId, values, contentHash);

    if (validation.status === 'drifted' && validation.needsHealing.length > 0) {
      const healing = await healContract(contractId, validation.needsHealing, result.markdown);

      if (webhookUrl) {
        await deliverContractWebhook(webhookUrl, {
          event: healing.status === 'healed' ? 'extraction.schema_healed' : 'extraction.needs_review',
          contractId,
          url,
          runId: healing.runId,
          timestamp: new Date().toISOString(),
          changedFields: validation.needsHealing,
          healedFields: healing.healedFields,
          diff: healing.diff,
          status: healing.status,
        });
      }
    } else if (validation.status === 'drifted' && webhookUrl) {
      await deliverContractWebhook(webhookUrl, {
        event: 'extraction.value_changed',
        contractId,
        url,
        runId: validation.runId,
        timestamp: new Date().toISOString(),
        changedFields: validation.needsHealing,
        status: 'drifted',
      });
    }

    await db
      .update(extractionContracts)
      .set({ lastRunAt: new Date(), updatedAt: new Date() })
      .where(eq(extractionContracts.id, contractId));
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    if (webhookUrl) {
      await deliverContractWebhook(webhookUrl, {
        event: 'extraction.needs_review',
        contractId,
        url,
        runId: 'error',
        timestamp: new Date().toISOString(),
        status: `failed: ${errorMsg}`,
      });
    }
  }
}
