import { z } from 'zod';
import { getZodTypeName } from '../ai';
import type { FieldFingerprint } from './types';

function extractRegexSample(values: string[]): string | undefined {
  if (values.length === 0) return undefined;
  const sample = values[0];
  let pattern = '';
  for (const ch of sample) {
    if (ch >= '0' && ch <= '9') pattern += '\\d';
    else if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) pattern += '[a-zA-Z]';
    else pattern += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  const compact = pattern.replace(/(\\[a-zA-Z]|\[[^\]]+\\])\1{4,}/g, (m) => m.slice(0, m.length / 2) + '+');
  if (compact.length > 3 && compact !== pattern && compact.length < 100) return `^${compact}$`;
  return undefined;
}

export function createFingerprint(
  schema: z.ZodObject<z.ZodRawShape>,
  values: Record<string, unknown>,
): Record<string, FieldFingerprint> {
  const shape = schema.shape;
  const fp: Record<string, FieldFingerprint> = {};

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const zodType = fieldSchema as z.ZodType;
    const typeName = getZodTypeName(zodType);
    const value = values[key];
    const isNull = value === null || value === undefined;
    const nullable = zodType instanceof z.ZodNullable || zodType instanceof z.ZodOptional;
    const sampleValues: unknown[] = isNull ? [] : [value];

    const base: FieldFingerprint = {
      type: isNull ? 'null' : (typeName as FieldFingerprint['type']),
      nullable,
      sampleValues,
    };

    if (isNull) {
      fp[key] = base;
      continue;
    }

    switch (typeof value) {
      case 'string': {
        const s = value as string;
        fp[key] = {
          ...base,
          type: 'string',
          minLength: s.length,
          maxLength: s.length,
          pattern: extractRegexSample([s]),
        };
        break;
      }
      case 'number': {
        const n = value as number;
        fp[key] = {
          ...base,
          type: 'number',
          min: n,
          max: n,
          isInteger: Number.isInteger(n),
        };
        break;
      }
      case 'boolean': {
        fp[key] = { ...base, type: 'boolean' };
        break;
      }
      default: {
        if (Array.isArray(value)) {
          fp[key] = {
            ...base,
            type: 'array',
            minItems: value.length,
            maxItems: value.length,
            itemType: value.length > 0 ? typeof value[0] : undefined,
          };
        } else {
          fp[key] = { ...base, type: 'object' };
        }
      }
    }
  }

  return fp;
}

export function validateAgainstFingerprint(
  values: Record<string, unknown>,
  fingerprint: Record<string, FieldFingerprint>,
): Record<string, { valid: boolean; reason?: string }> {
  const results: Record<string, { valid: boolean; reason?: string }> = {};

  for (const [key, fp] of Object.entries(fingerprint)) {
    const value = values[key];

    if (value === null || value === undefined) {
      if (fp.nullable || fp.type === 'null') {
        results[key] = { valid: true };
      } else {
        results[key] = { valid: false, reason: `field "${key}" is null but fingerprint expects non-null ${fp.type}` };
      }
      continue;
    }

    switch (fp.type) {
      case 'string': {
        if (typeof value !== 'string') {
          results[key] = { valid: false, reason: `expected string, got ${typeof value}` };
          continue;
        }
        const s = value as string;
        if (fp.minLength !== undefined && s.length < fp.minLength * 0.3) {
          results[key] = { valid: false, reason: `string too short: ${s.length} < ${fp.minLength}` };
          continue;
        }
        if (fp.maxLength !== undefined && s.length > fp.maxLength * 3 && fp.maxLength > 0) {
          results[key] = { valid: false, reason: `string too long: ${s.length} > ${fp.maxLength}` };
          continue;
        }
        if (fp.pattern) {
          try {
            const re = new RegExp(fp.pattern);
            if (!re.test(s)) {
              results[key] = { valid: false, reason: `string does not match pattern` };
              continue;
            }
          } catch {
            // bad regex in fingerprint — skip pattern check
          }
        }
        results[key] = { valid: true };
        break;
      }

      case 'number': {
        if (typeof value !== 'number' || isNaN(value)) {
          results[key] = { valid: false, reason: `expected number, got ${typeof value}` };
          continue;
        }
        const n = value as number;
        if (fp.isInteger && !Number.isInteger(n)) {
          results[key] = { valid: false, reason: 'expected integer' };
          continue;
        }
        if (fp.min !== undefined && fp.max !== undefined) {
          const range = fp.max - fp.min;
          const absMax = Math.max(Math.abs(fp.min), Math.abs(fp.max));
          if (range === 0 && absMax > 0 && n !== fp.min) {
            results[key] = { valid: false, reason: `number changed from ${fp.min} to ${n}` };
            continue;
          }
        }
        results[key] = { valid: true };
        break;
      }

      case 'boolean': {
        results[key] = {
          valid: typeof value === 'boolean',
          reason: typeof value !== 'boolean' ? `expected boolean, got ${typeof value}` : undefined,
        };
        break;
      }

      case 'array': {
        if (!Array.isArray(value)) {
          results[key] = { valid: false, reason: `expected array, got ${typeof value}` };
          continue;
        }
        const arr = value as unknown[];
        if (fp.minItems !== undefined && fp.maxItems !== undefined) {
          const bandMid = (fp.minItems + fp.maxItems) / 2;
          if (bandMid > 0 && arr.length < bandMid * 0.2) {
            results[key] = { valid: false, reason: `array shrunk from ~${bandMid} to ${arr.length}` };
            continue;
          }
        }
        results[key] = { valid: true };
        break;
      }

      case 'object': {
        results[key] = {
          valid: typeof value === 'object' && value !== null && !Array.isArray(value),
          reason: typeof value !== 'object' ? `expected object, got ${typeof value}` : undefined,
        };
        break;
      }

      default:
        results[key] = { valid: true };
    }
  }

  return results;
}

export function mergeFingerprint(
  existing: Record<string, FieldFingerprint>,
  incoming: Record<string, FieldFingerprint>,
): Record<string, FieldFingerprint> {
  const merged: Record<string, FieldFingerprint> = { ...existing };

  for (const [key, inc] of Object.entries(incoming)) {
    const prev = merged[key];
    if (!prev) {
      merged[key] = inc;
      continue;
    }

    merged[key] = { ...prev };

    if (inc.type !== 'null' && prev.type !== 'null') {
      if (inc.minLength !== undefined) {
        merged[key].minLength = Math.min(prev.minLength ?? Infinity, inc.minLength);
      }
      if (inc.maxLength !== undefined) {
        merged[key].maxLength = Math.max(prev.maxLength ?? 0, inc.maxLength);
      }
      if (inc.min !== undefined) {
        merged[key].min = Math.min(prev.min ?? Infinity, inc.min);
      }
      if (inc.max !== undefined) {
        merged[key].max = Math.max(prev.max ?? -Infinity, inc.max);
      }
      if (inc.minItems !== undefined) {
        merged[key].minItems = Math.min(prev.minItems ?? Infinity, inc.minItems);
      }
      if (inc.maxItems !== undefined) {
        merged[key].maxItems = Math.max(prev.maxItems ?? 0, inc.maxItems);
      }
    }

    const existingSamples = new Set(prev.sampleValues.map((v) => JSON.stringify(v)));
    for (const sv of inc.sampleValues) {
      if (!existingSamples.has(JSON.stringify(sv))) {
        merged[key].sampleValues = [...prev.sampleValues.slice(-4), sv];
      }
    }

    if (inc.nullable) merged[key].nullable = true;
  }

  return merged;
}

export function diffFieldValues(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  for (const key of allKeys) {
    const before = oldValues[key];
    const after = newValues[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diff[key] = { before, after };
    }
  }

  return diff;
}
