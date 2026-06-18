import { describe, it, expect, vi } from 'vitest';

vi.mock('../../ai', () => ({
  getZodTypeName: (field: any) => {
    if (field._def?.typeName === 'ZodString') return 'string';
    if (field._def?.typeName === 'ZodNumber') return 'number';
    if (field._def?.typeName === 'ZodBoolean') return 'boolean';
    if (field._def?.typeName === 'ZodArray') return 'array';
    if (field._def?.typeName === 'ZodObject') return 'object';
    if (field._def?.typeName === 'ZodNullable') return 'string';
    if (field._def?.typeName === 'ZodOptional') return 'string';
    return 'unknown';
  },
  compareValues: () => 1.0,
}));

import { z } from 'zod';
import {
  createFingerprint,
  validateAgainstFingerprint,
  mergeFingerprint,
  diffFieldValues,
} from '../../extraction/fingerprint';

const BaseSchema = z.object({
  name: z.string(),
  price: z.number(),
  inStock: z.boolean(),
  tags: z.array(z.string()),
});

describe('createFingerprint', () => {
  it('fingerprints string fields with length and pattern', () => {
    const fp = createFingerprint(BaseSchema, {
      name: 'Acme',
      price: 49,
      inStock: true,
      tags: ['widget', 'gadget'],
    });

    expect(fp.name.type).toBe('string');
    expect(fp.name.minLength).toBe(4);
    expect(fp.name.maxLength).toBe(4);
    expect(fp.name.nullable).toBe(false);
    expect(fp.name.sampleValues).toEqual(['Acme']);
  });

  it('fingerprints numeric fields with range', () => {
    const fp = createFingerprint(BaseSchema, {
      name: 'Acme',
      price: 49,
      inStock: true,
      tags: ['widget'],
    });

    expect(fp.price.type).toBe('number');
    expect(fp.price.min).toBe(49);
    expect(fp.price.max).toBe(49);
    expect(fp.price.isInteger).toBe(true);
  });

  it('fingerprints boolean fields', () => {
    const fp = createFingerprint(BaseSchema, {
      name: 'Acme',
      price: 49,
      inStock: true,
      tags: [],
    });

    expect(fp.inStock.type).toBe('boolean');
    expect(fp.inStock.sampleValues).toEqual([true]);
  });

  it('fingerprints array fields with item count band', () => {
    const fp = createFingerprint(BaseSchema, {
      name: 'Acme',
      price: 49,
      inStock: true,
      tags: ['a', 'b', 'c'],
    });

    expect(fp.tags.type).toBe('array');
    expect(fp.tags.minItems).toBe(3);
    expect(fp.tags.maxItems).toBe(3);
  });

  it('handles null values with nullable schemas', () => {
    const NullableSchema = z.object({
      phone: z.string().nullable(),
    });

    const fp = createFingerprint(NullableSchema, { phone: null });

    expect(fp.phone.type).toBe('null');
    expect(fp.phone.nullable).toBe(true);
    expect(fp.phone.sampleValues).toEqual([]);
  });

  it('handles empty arrays', () => {
    const fp = createFingerprint(BaseSchema, {
      name: 'Acme',
      price: 49,
      inStock: true,
      tags: [],
    });

    expect(fp.tags.minItems).toBe(0);
    expect(fp.tags.maxItems).toBe(0);
  });
});

describe('validateAgainstFingerprint', () => {
  const baseFp = createFingerprint(BaseSchema, {
    name: 'Acme Corp',
    price: 49,
    inStock: true,
    tags: ['widget'],
  });

  it('validates matching values as ok', () => {
    const result = validateAgainstFingerprint(
      { name: 'Acme Corp', price: 49, inStock: true, tags: ['widget'] },
      baseFp,
    );

    expect(result.name.valid).toBe(true);
    expect(result.price.valid).toBe(true);
    expect(result.inStock.valid).toBe(true);
    expect(result.tags.valid).toBe(true);
  });

  it('detects type mismatch on string field', () => {
    const result = validateAgainstFingerprint(
      { name: 123, price: 49, inStock: true, tags: ['widget'] },
      baseFp,
    );

    expect(result.name.valid).toBe(false);
    expect(result.name.reason).toContain('string');
  });

  it('detects type mismatch on number field', () => {
    const result = validateAgainstFingerprint(
      { name: 'Acme Corp', price: 'free', inStock: true, tags: ['widget'] },
      baseFp,
    );

    expect(result.price.valid).toBe(false);
  });

  it('detects array shrink', () => {
    const fp = createFingerprint(BaseSchema, {
      name: 'Acme',
      price: 49,
      inStock: true,
      tags: ['a', 'b', 'c', 'd', 'e'],
    });

    const result = validateAgainstFingerprint(
      { name: 'Acme', price: 49, inStock: true, tags: [] },
      fp,
    );

    expect(result.tags.valid).toBe(false);
    expect(result.tags.reason).toContain('shrunk');
  });

  it('accepts null when field is nullable', () => {
    const fp = createFingerprint(BaseSchema, {
      name: 'Acme',
      price: 49,
      inStock: true,
      tags: ['widget'],
    });
    // Force nullable flag
    fp.name.nullable = true;

    const result = validateAgainstFingerprint(
      { name: null, price: 49, inStock: true, tags: ['widget'] },
      fp,
    );

    expect(result.name.valid).toBe(true);
  });

  it('detects null when field is not nullable', () => {
    const result = validateAgainstFingerprint(
      { name: null, price: 49, inStock: true, tags: ['widget'] },
      baseFp,
    );

    expect(result.name.valid).toBe(false);
  });

  it('handles fields not in values gracefully', () => {
    const result = validateAgainstFingerprint(
      { price: 49, inStock: true, tags: ['widget'] },
      baseFp,
    );

    expect(result.name.valid).toBe(false);
    expect(result.name.reason).toContain('null');
  });

  it('accepts strings within length tolerance', () => {
    const result = validateAgainstFingerprint(
      { name: 'Acme Corp Updated', price: 49, inStock: true, tags: ['widget'] },
      baseFp,
    );

    expect(result.name.valid).toBe(true);
  });
});

describe('mergeFingerprint', () => {
  it('widens numeric range on merge', () => {
    const first = createFingerprint(BaseSchema, {
      name: 'Acme', price: 19, inStock: true, tags: ['x'],
    });
    const second = createFingerprint(BaseSchema, {
      name: 'Acme', price: 99, inStock: true, tags: ['y'],
    });

    const merged = mergeFingerprint(first, second);

    expect(merged.price.min).toBe(19);
    expect(merged.price.max).toBe(99);
  });

  it('accumulates sample values', () => {
    const first = createFingerprint(BaseSchema, {
      name: 'Acme', price: 49, inStock: true, tags: ['a'],
    });
    const second = createFingerprint(BaseSchema, {
      name: 'Corp', price: 49, inStock: true, tags: ['b'],
    });

    const merged = mergeFingerprint(first, second);

    expect(merged.name.sampleValues.length).toBeGreaterThan(1);
  });

  it('preserves existing fields not in incoming', () => {
    const first = createFingerprint(BaseSchema, {
      name: 'A', price: 10, inStock: true, tags: [],
    });
    const second = createFingerprint(
      z.object({ name: z.string() }),
      { name: 'B' },
    );

    const merged = mergeFingerprint(first, second);

    expect(merged.price).toBeDefined();
    expect(merged.price.min).toBe(10);
  });
});

describe('diffFieldValues', () => {
  it('returns empty diff when values are identical', () => {
    const oldVal = { name: 'Acme', price: 49 };
    const newVal = { name: 'Acme', price: 49 };

    const diff = diffFieldValues(oldVal, newVal);
    expect(Object.keys(diff)).toHaveLength(0);
  });

  it('detects changed values', () => {
    const oldVal = { name: 'Acme', price: 49 };
    const newVal = { name: 'Acme', price: 99 };

    const diff = diffFieldValues(oldVal, newVal);

    expect(diff.price).toEqual({ before: 49, after: 99 });
  });

  it('detects new fields', () => {
    const oldVal = { name: 'Acme' };
    const newVal = { name: 'Acme', price: 49 };

    const diff = diffFieldValues(oldVal, newVal);

    expect(diff.price).toEqual({ before: undefined, after: 49 });
  });

  it('detects removed fields', () => {
    const oldVal = { name: 'Acme', price: 49 };
    const newVal = { name: 'Acme' };

    const diff = diffFieldValues(oldVal, newVal);

    expect(diff.price).toEqual({ before: 49, after: undefined });
  });
});
