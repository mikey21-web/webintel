import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { z } from 'zod';
import { config } from './config';

let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;

if (config.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
}

if (config.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExtractionStatus = 'ok' | 'needs_review';

export interface FieldResult<T = unknown> {
  value: T;
  confidence: number;
  status: ExtractionStatus;
  source_providers: string[];
}

export type ConfidenceEnvelope<T> = {
  fields: { [K in keyof T]: FieldResult<T[K]> };
  meta: {
    modelAgreement: number;
    extractionTimeMs: number;
  };
};

export interface ExtractOptions {
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const startObj = text.indexOf('{');
    const endObj = text.lastIndexOf('}');
    const startArr = text.indexOf('[');
    const endArr = text.lastIndexOf(']');

    if (startObj !== -1 && endObj > startObj) {
      try {
        return JSON.parse(text.slice(startObj, endObj + 1)) as T;
      } catch {
        // fall through
      }
    }
    if (startArr !== -1 && endArr > startArr) {
      try {
        return JSON.parse(text.slice(startArr, endArr + 1)) as T;
      } catch {
        // fall through
      }
    }
    throw new Error('AI returned invalid JSON: ' + text.slice(0, 200));
  }
}

function parseAndValidate<T>(
  rawText: string,
  schema: z.ZodSchema<T>,
): { success: true; data: T } | { success: false; error: string } {
  try {
    const parsed = extractJson(rawText);
    const result = schema.safeParse(parsed);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: formatZodError(result.error) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown parse error',
    };
  }
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
}

export function getZodTypeName(field: z.ZodType): string {
  if (field instanceof z.ZodString) return 'string';
  if (field instanceof z.ZodNumber) return 'number';
  if (field instanceof z.ZodBoolean) return 'boolean';
  if (field instanceof z.ZodArray) return 'array';
  if (field instanceof z.ZodObject) return 'object';
  if (field instanceof z.ZodNullable) return getZodTypeName(field.unwrap());
  if (field instanceof z.ZodOptional) return getZodTypeName(field.unwrap());
  return 'unknown';
}

function buildExtractionSystemPrompt<T>(schema: z.ZodSchema<T>): string {
  if (schema instanceof z.ZodObject) {
    const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
    const lines = Object.entries(shape).map(([key, field]) => {
      const desc = (field as z.ZodType).description ? ` — ${(field as z.ZodType).description}` : '';
      return `- "${key}": ${getZodTypeName(field as z.ZodType)}${desc}`;
    });
    return (
      'Extract data from the content below. Return ONLY valid JSON with exactly these fields:\n' +
      lines.join('\n') +
      '\n\nIf a field is not found in the content, use null for that field. Do not invent data.'
    );
  }

  if (schema instanceof z.ZodArray) {
    return (
      'Extract data from the content below. Return ONLY a valid JSON array. ' +
      'Each item should contain the relevant extracted information. ' +
      'Return an empty array if nothing is found. Do not invent data.'
    );
  }

  return (
    'Extract the requested data from the content below. ' +
    'Return ONLY valid JSON. Do not invent data.'
  );
}

// ---------------------------------------------------------------------------
// Value comparison for dual-LLM agreement
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return curr[n];
}

export function compareValues(a: unknown, b: unknown): number {
  // Both null/undefined → perfect agreement (both agree field is absent)
  if ((a === null || a === undefined) && (b === null || b === undefined)) return 1.0;
  // One null, one not → complete disagreement
  if (a === null || a === undefined || b === null || b === undefined) return 0.0;

  // Boolean comparison
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b ? 1.0 : 0.0;
  }

  // Number comparison
  if (typeof a === 'number' && typeof b === 'number') {
    if (a === b) return 1.0;
    const larger = Math.max(Math.abs(a), Math.abs(b));
    if (larger === 0) return 1.0;
    const diff = Math.abs(a - b) / larger;
    if (diff <= 0.05) return 0.9;
    if (diff <= 0.2) return 0.7;
    return 0.0;
  }

  // Type mismatch (e.g. one string, one number)
  if (typeof a !== typeof b) return 0.0;

  // Array comparison
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length === 0 && b.length === 0) return 1.0;
    const maxLen = Math.max(a.length, b.length);
    let matches = 0;
    const bCopy = [...b];
    for (const itemA of a) {
      const idx = bCopy.findIndex((itemB) => compareValues(itemA, itemB) >= 0.7);
      if (idx !== -1) {
        matches++;
        bCopy.splice(idx, 1);
      }
    }
    return matches / maxLen;
  }

  // String comparison
  if (typeof a === 'string' && typeof b === 'string') {
    if (a === b) return 1.0;
    if (a.toLowerCase().trim() === b.toLowerCase().trim()) return 0.95;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1.0;
    const dist = levenshtein(a, b);
    const similarity = 1 - dist / maxLen;
    if (similarity >= 0.9) return 0.9;
    if (similarity >= 0.7) return 0.7;
    return 0.0;
  }

  // Object comparison (shallow key/value)
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);
    const allKeys = new Set([...keysA, ...keysB]);
    let score = 0;
    for (const key of allKeys) {
      if (key in (a as Record<string, unknown>) && key in (b as Record<string, unknown>)) {
        score += compareValues(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        );
      }
    }
    return allKeys.size > 0 ? score / allKeys.size : 1.0;
  }

  return 0.0;
}

// ---------------------------------------------------------------------------
// Shape conformance
// ---------------------------------------------------------------------------

export function shapeConformance(value: unknown, fieldSchema: z.ZodType): number {
  if (value === null || value === undefined) return 1.0;
  const result = fieldSchema.safeParse(value);
  if (result.success) {
    let score = 1.0;

    if (typeof value === 'string') {
      if (value.trim().length === 0) score = 0.5;
    }

    if (Array.isArray(value) && fieldSchema instanceof z.ZodArray) {
      if (value.length === 0) score = 0.5;
    }

    if (typeof value === 'number' && isNaN(value)) score = 0.0;

    return score;
  }
  return 0.0;
}

// ---------------------------------------------------------------------------
// Provider calling
// ---------------------------------------------------------------------------

interface ProviderCallResult<T> {
  provider: string;
  values: T | null;
  error: string | null;
  rawText: string | null;
}

async function callProvider<T>(
  label: string,
  system: string,
  prompt: string,
  schema: z.ZodSchema<T>,
  signal?: AbortSignal,
): Promise<ProviderCallResult<T>> {
  let rawText = '';

  try {
    if (label === 'openai') {
      if (!openai) throw new Error('OpenAI not configured');
      const response = await openai.chat.completions.create(
        {
          model: config.OPENAI_MODEL || 'gpt-4o',
          max_tokens: 8192,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        },
        { signal },
      );
      rawText = response.choices[0]?.message?.content || '';
    } else if (label === 'anthropic') {
      if (!anthropic) throw new Error('Anthropic not configured');
      const response = await anthropic.messages.create(
        {
          model: config.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          system,
          messages: [{ role: 'user', content: prompt }],
        },
        { signal },
      );
      rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    } else {
      throw new Error(`Unknown provider: ${label}`);
    }

    const parsed = parseAndValidate(rawText, schema);
    if (parsed.success) {
      return { provider: label, values: parsed.data, error: null, rawText };
    }

    // Retry once with validation error feedback
    const retryPrompt = `${prompt}\n\nYour previous response was invalid due to these issues:\n${parsed.error}\n\nPlease fix all issues and return ONLY valid JSON matching the requested schema.`;
    let retryText = '';

    if (label === 'openai' && openai) {
      const retryResponse = await openai.chat.completions.create(
        {
          model: config.OPENAI_MODEL || 'gpt-4o',
          max_tokens: 8192,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: retryPrompt },
          ],
          response_format: { type: 'json_object' },
        },
        { signal },
      );
      retryText = retryResponse.choices[0]?.message?.content || '';
    } else if (label === 'anthropic' && anthropic) {
      const retryResponse = await anthropic.messages.create(
        {
          model: config.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          system,
          messages: [{ role: 'user', content: retryPrompt }],
        },
        { signal },
      );
      retryText = retryResponse.content[0].type === 'text' ? retryResponse.content[0].text : '';
    }

    const retryParsed = parseAndValidate(retryText, schema);
    if (retryParsed.success) {
      return { provider: label, values: retryParsed.data, error: null, rawText: retryText };
    }

    return {
      provider: label,
      values: null,
      error: `After retry: ${retryParsed.error}`,
      rawText: retryText || rawText,
    };
  } catch (err) {
    return {
      provider: label,
      values: null,
      error: err instanceof Error ? err.message : 'Unknown error',
      rawText: rawText || null,
    };
  }
}

// ---------------------------------------------------------------------------
// Main: extractWithConfidence
// ---------------------------------------------------------------------------

export async function extractWithConfidence<T extends Record<string, unknown>>(
  schema: z.ZodSchema<T>,
  content: string,
  options: ExtractOptions = {},
): Promise<ConfidenceEnvelope<T>> {
  const startTime = Date.now();

  const system = buildExtractionSystemPrompt(schema);
  const prompt = `Content:\n\n${content}`;

  const providerLabels: string[] = [];
  if (openai) providerLabels.push('openai');
  if (anthropic) providerLabels.push('anthropic');

  if (providerLabels.length === 0) {
    throw new Error('No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
  }

  const results = await Promise.all(
    providerLabels.map((label) =>
      callProvider(label, system, prompt, schema, options.signal),
    ),
  );

  const successful = results.filter((r) => r.values !== null);
  const schemaKeys = Object.keys(
    schema instanceof z.ZodObject ? (schema as z.ZodObject<z.ZodRawShape>).shape : {},
  );

  const fields = {} as { [K in keyof T]: FieldResult<T[K]> };
  let totalAgreement = 0;

  if (successful.length === 0) {
    for (const key of schemaKeys) {
      fields[key as keyof T] = {
        value: null as T[keyof T],
        confidence: 0,
        status: 'needs_review',
        source_providers: [],
      };
    }
  } else if (successful.length === 1) {
    const only = successful[0];
    for (const key of schemaKeys) {
      const val = (only.values as Record<string, unknown>)[key];
      const fieldSchema = schema instanceof z.ZodObject
        ? (schema as z.ZodObject<z.ZodRawShape>).shape[key]
        : z.any();
      const shape = fieldSchema ? shapeConformance(val, fieldSchema as z.ZodType) : 0.5;
      const confidence = Math.round((shape * 100)) / 100;
      fields[key as keyof T] = {
        value: val as T[keyof T],
        confidence,
        status: confidence >= 0.5 ? 'ok' : 'needs_review',
        source_providers: [only.provider],
      };
    }
    totalAgreement = 0.5;
  } else {
    const [resultA, resultB] = successful;
    let agreementSum = 0;

    for (const key of schemaKeys) {
      const valA = (resultA.values as Record<string, unknown>)[key];
      const valB = (resultB.values as Record<string, unknown>)[key];
      const agreement = compareValues(valA, valB);
      agreementSum += agreement;

      const fieldSchema = schema instanceof z.ZodObject
        ? (schema as z.ZodObject<z.ZodRawShape>).shape[key]
        : z.any();
      const shape = fieldSchema ? shapeConformance(valA, fieldSchema as z.ZodType) : 0.5;
      const confidence = Math.round((0.7 * agreement + 0.3 * shape) * 100) / 100;

      const preferredValue = valA ?? valB;
      const status: ExtractionStatus = confidence >= 0.6 ? 'ok' : 'needs_review';

      fields[key as keyof T] = {
        value: preferredValue as T[keyof T],
        confidence,
        status,
        source_providers: [resultA.provider, resultB.provider],
      };
    }

    totalAgreement =
      schemaKeys.length > 0
        ? Math.round((agreementSum / schemaKeys.length) * 100) / 100
        : 1.0;
  }

  return {
    fields,
    meta: {
      modelAgreement: totalAgreement,
      extractionTimeMs: Date.now() - startTime,
    },
  };
}

// ---------------------------------------------------------------------------
// extractPromptOnly — natural-language extraction (no schema)
// ---------------------------------------------------------------------------

export async function extractPromptOnly(
  instruction: string,
  content: string,
  options: ExtractOptions = {},
): Promise<ConfidenceEnvelope<Record<string, unknown>>> {
  const startTime = Date.now();
  const system =
    'Extract data from the content following the instruction. Return ONLY valid JSON as a flat object. ' +
    'Put extracted values at meaningful keys. If a piece of data is not found, set its value to null. Do not invent data.';
  const prompt = `Instruction: ${instruction}\n\nContent:\n\n${content}`;

  const providerLabels: string[] = [];
  if (openai) providerLabels.push('openai');
  if (anthropic) providerLabels.push('anthropic');

  if (providerLabels.length === 0) {
    throw new Error('No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
  }

  const flexibleSchema = z.record(z.unknown());
  const results = await Promise.all(
    providerLabels.map((label) =>
      callProvider(label, system, prompt, flexibleSchema, options.signal),
    ),
  );

  const successful = results.filter((r) => r.values !== null);

  if (successful.length === 0) {
    return {
      fields: {} as Record<string, FieldResult>,
      meta: { modelAgreement: 0, extractionTimeMs: Date.now() - startTime },
    };
  }

  if (successful.length === 1) {
    const val = successful[0].values as Record<string, unknown>;
    const fields: Record<string, FieldResult> = {};
    for (const key of Object.keys(val)) {
      fields[key] = {
        value: val[key],
        confidence: 0.6,
        status: 'ok',
        source_providers: [successful[0].provider],
      };
    }
    return {
      fields,
      meta: { modelAgreement: 0.5, extractionTimeMs: Date.now() - startTime },
    };
  }

  const valA = successful[0].values as Record<string, unknown>;
  const valB = successful[1].values as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(valA), ...Object.keys(valB)]);
  let agreementSum = 0;

  const fields: Record<string, FieldResult> = {};
  for (const key of allKeys) {
    const a = key in valA ? valA[key] : undefined;
    const b = key in valB ? valB[key] : undefined;
    const agreement = compareValues(a, b);
    agreementSum += agreement;

    const preferredValue = a !== undefined && a !== null ? a : b;
    const confidence = Math.round((0.7 * agreement + 0.3) * 100) / 100;
    const status: ExtractionStatus = confidence >= 0.5 ? 'ok' : 'needs_review';

    fields[key] = {
      value: preferredValue,
      confidence,
      status,
      source_providers: [successful[0].provider, successful[1].provider].filter(Boolean),
    };
  }

  const modelAgreement =
    allKeys.size > 0 ? Math.round((agreementSum / allKeys.size) * 100) / 100 : 1.0;

  return {
    fields,
    meta: {
      modelAgreement,
      extractionTimeMs: Date.now() - startTime,
    },
  };
}

// ---------------------------------------------------------------------------
// Existing askAI (unchanged — backwards compatible)
// ---------------------------------------------------------------------------

export async function askAI<T>(
  system: string,
  prompt: string,
  format: 'json' | 'text' = 'json',
): Promise<T> {
  const providers: { label: string; fn: () => Promise<T> }[] = [];

  if (openai) {
    providers.push({
      label: 'openai',
      fn: async () => {
        const response = await openai!.chat.completions.create({
          model: config.OPENAI_MODEL || 'gpt-4o',
          max_tokens: 8192,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          response_format: format === 'json' ? { type: 'json_object' } : undefined,
        });
        const text = response.choices[0]?.message?.content || '';
        if (format === 'json') return extractJson<T>(text);
        return text as unknown as T;
      },
    });
  }

  if (anthropic) {
    providers.push({
      label: 'anthropic',
      fn: async () => {
        const response = await anthropic!.messages.create({
          model: config.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          system,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        if (format === 'json') return extractJson<T>(text);
        return text as unknown as T;
      },
    });
  }

  if (providers.length === 0) {
    throw new Error('No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
  }

  const errors: { label: string; error: unknown }[] = [];
  for (const provider of providers) {
    try {
      return await provider.fn();
    } catch (err) {
      errors.push({ label: provider.label, error: err });
    }
  }

  const detail = errors
    .map((e) => `${e.label}: ${e.error instanceof Error ? e.error.message : e.error}`)
    .join('; ');
  throw new Error(`All AI providers failed: ${detail}`);
}
