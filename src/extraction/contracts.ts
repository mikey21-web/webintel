import crypto from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { extractionContracts, extractionRuns } from '../db/schema';
import {
  createFingerprint,
  mergeFingerprint,
  validateAgainstFingerprint,
  diffFieldValues,
} from './fingerprint';
import { extractWithConfidence } from '../ai';
import { z } from 'zod';
import type {
  CaptureContractParams,
  ValidateContractResult,
  HealContractResult,
  ContractProvenance,
  SemanticAnchor,
} from './types';

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function buildFocusedSchema(
  contractSchema: any,
  fields: string[],
): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};
  for (const field of fields) {
    const def = contractSchema.fields?.[field];
    if (!def) {
      shape[field] = z.unknown().nullable();
      continue;
    }
    let fieldSchema: z.ZodType;
    switch (def.type) {
      case 'string': fieldSchema = z.string(); break;
      case 'number': fieldSchema = z.number(); break;
      case 'boolean': fieldSchema = z.boolean(); break;
      case 'array': fieldSchema = z.array(z.unknown()); break;
      default: fieldSchema = z.unknown(); break;
    }
    shape[field] = def.nullable !== false ? fieldSchema.nullable() : fieldSchema;
  }
  return z.object(shape);
}

export async function captureContract(
  params: CaptureContractParams,
): Promise<{ contractId: string; isNew: boolean }> {
  const fp = createFingerprint(
    z.object(
      Object.fromEntries(
        Object.entries(params.schema.fields).map(([k, v]) => {
          let f: z.ZodType;
          switch (v.type) {
            case 'string': f = z.string(); break;
            case 'number': f = z.number(); break;
            case 'boolean': f = z.boolean(); break;
            case 'array': f = z.array(z.unknown()); break;
            default: f = z.unknown(); break;
          }
          return [k, v.nullable !== false ? f.nullable() : f];
        }),
      ),
    ) as z.ZodObject<z.ZodRawShape>,
    params.values,
  );

  const provenanceEntry: ContractProvenance = {
    timestamp: new Date().toISOString(),
    contentHash: params.contentHash,
    sourceUrl: params.url,
    sourceSnippets: params.sourceSnippets,
    fields: params.values,
    healed: false,
  };

  const [existing] = await db
    .select()
    .from(extractionContracts)
    .where(
      and(
        eq(extractionContracts.userId, params.userId),
        eq(extractionContracts.url, params.url),
      ),
    )
    .limit(1);

  if (existing) {
    const mergedFp = mergeFingerprint(
      existing.fingerprint as Record<string, any>,
      fp,
    );
    const provenance = [
      ...(existing.provenance as ContractProvenance[]),
      provenanceEntry,
    ];

    await db
      .update(extractionContracts)
      .set({
        fingerprint: mergedFp,
        provenance,
        semanticAnchors: params.semanticAnchors
          ? (params.semanticAnchors as SemanticAnchor[])
          : existing.semanticAnchors,
        lastRunAt: new Date(),
        runCount: (existing.runCount ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(extractionContracts.id, existing.id));

    await db
      .insert(extractionRuns)
      .values({
        contractId: existing.id,
        status: 'ok',
        contentHash: params.contentHash,
        values: params.values,
        confidence: params.confidence,
        validationResult: {},
        diffFromContract: null,
        healedFields: [],
      });

    return { contractId: existing.id, isNew: false };
  }

  const [contract] = await db
    .insert(extractionContracts)
    .values({
      userId: params.userId,
      url: params.url,
      schema: params.schema,
      fingerprint: fp,
      semanticAnchors: (params.semanticAnchors ?? []) as SemanticAnchor[],
      provenance: [provenanceEntry],
      lastRunAt: new Date(),
      runCount: 1,
      active: true,
    })
    .returning();

  await db.insert(extractionRuns).values({
    contractId: contract.id,
    status: 'ok',
    contentHash: params.contentHash,
    values: params.values,
    confidence: params.confidence,
    validationResult: {},
    diffFromContract: null,
    healedFields: [],
  });

  return { contractId: contract.id, isNew: true };
}

export async function validateContract(
  contractId: string,
  values: Record<string, unknown>,
  contentHash: string,
): Promise<ValidateContractResult> {
  const [contract] = await db
    .select()
    .from(extractionContracts)
    .where(eq(extractionContracts.id, contractId))
    .limit(1);

  if (!contract) {
    throw new Error(`Contract ${contractId} not found`);
  }

  const fp = contract.fingerprint as Record<string, any>;
  const validation = validateAgainstFingerprint(values, fp);
  const needsHealing = Object.entries(validation)
    .filter(([, r]) => !r.valid)
    .map(([key]) => key);

  const status = needsHealing.length === 0 ? 'ok' : 'drifted';

  const [run] = await db
    .insert(extractionRuns)
    .values({
      contractId: contract.id,
      status,
      contentHash,
      values,
      confidence: {},
      validationResult: validation,
      diffFromContract: null,
      healedFields: [],
    })
    .returning();

  return {
    status,
    runId: run.id,
    fields: validation,
    needsHealing,
  };
}

export async function healContract(
  contractId: string,
  failedFields: string[],
  content: string,
): Promise<HealContractResult> {
  const [contract] = await db
    .select()
    .from(extractionContracts)
    .where(eq(extractionContracts.id, contractId))
    .limit(1);

  if (!contract) {
    throw new Error(`Contract ${contractId} not found`);
  }

  const contractSchema = contract.schema as any;
  const provenance = (contract.provenance as ContractProvenance[]) ?? [];
  const latestProvenance = provenance[provenance.length - 1];
  const latestValues = latestProvenance?.fields ?? {};

  const oldValues: Record<string, unknown> = {};
  for (const field of failedFields) {
    oldValues[field] = latestValues[field] ?? null;
  }

  const focusedSchema = buildFocusedSchema(contractSchema, failedFields);

  const newValues: Record<string, unknown> = {};
  const healedFields: string[] = [];
  let status: 'healed' | 'needs_review' = 'healed';

  try {
    const result = await extractWithConfidence(focusedSchema, content);
    for (const [key, fieldResult] of Object.entries(result.fields) as [
      string,
      { value: unknown; confidence: number; status: string },
    ][]) {
      newValues[key] = fieldResult.value;
      if (fieldResult.status === 'ok') {
        healedFields.push(key);
      }
    }
    if (healedFields.length === 0) {
      status = 'needs_review';
    }
  } catch {
    status = 'needs_review';
  }

  const diff = diffFieldValues(oldValues, newValues);
  const contentHash = hashContent(content);

  const provenanceEntry: ContractProvenance = {
    timestamp: new Date().toISOString(),
    contentHash,
    sourceUrl: contract.url,
    sourceSnippets: {},
    fields: { ...latestValues, ...newValues },
    healed: true,
  };

  const updatedProvenance = [...provenance, provenanceEntry];

  await db
    .update(extractionContracts)
    .set({
      provenance: updatedProvenance,
      lastHealedAt: status === 'healed' ? new Date() : contract.lastHealedAt,
      lastRunAt: new Date(),
      runCount: (contract.runCount ?? 0) + 1,
      updatedAt: new Date(),
    })
    .where(eq(extractionContracts.id, contractId));

  const [run] = await db
    .insert(extractionRuns)
    .values({
      contractId: contract.id,
      status,
      contentHash,
      values: newValues,
      confidence: {},
      validationResult: {},
      diffFromContract: diff,
      healedFields,
    })
    .returning();

  return {
    status,
    runId: run.id,
    healedFields,
    diff,
    newValues,
  };
}

export async function listContracts(userId: string) {
  return db
    .select()
    .from(extractionContracts)
    .where(eq(extractionContracts.userId, userId))
    .orderBy(desc(extractionContracts.createdAt));
}

export async function getContract(contractId: string, userId?: string) {
  const conditions = [eq(extractionContracts.id, contractId)];
  if (userId) conditions.push(eq(extractionContracts.userId, userId));

  const [contract] = await db
    .select()
    .from(extractionContracts)
    .where(and(...conditions))
    .limit(1);

  return contract ?? null;
}

export async function getContractRuns(contractId: string, limit = 20, offset = 0) {
  return db
    .select()
    .from(extractionRuns)
    .where(eq(extractionRuns.contractId, contractId))
    .orderBy(desc(extractionRuns.extractedAt))
    .limit(limit)
    .offset(offset);
}

export async function deleteContract(contractId: string, userId: string) {
  const [deleted] = await db
    .delete(extractionContracts)
    .where(
      and(
        eq(extractionContracts.id, contractId),
        eq(extractionContracts.userId, userId),
      ),
    )
    .returning();

  return deleted ?? null;
}
