import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

const { mockOpenAICreate, mockAnthropicCreate } = vi.hoisted(() => ({
  mockOpenAICreate: vi.fn(),
  mockAnthropicCreate: vi.fn(),
}));

vi.mock('../config', () => ({
  config: {
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    OPENAI_API_KEY: 'test-openai-key',
    OPENAI_MODEL: 'gpt-4o',
    ANTHROPIC_MODEL: 'claude-sonnet-4-20250514',
    CONFIDENCE_CALIBRATION_PATH: 'src/__tests__/fixtures/golden-set',
  },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  })),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOpenAICreate } },
  })),
}));

import { extractWithConfidence } from '../ai';

interface FixtureExpected {
  value: unknown;
  minConfidence: number;
}

interface Fixture {
  id: string;
  url: string;
  rawHtml: string;
  extractedRawText: string;
  schema: Record<string, { type: string; description?: string }>;
  expected: Record<string, FixtureExpected>;
  mockResponses: {
    openai: string;
    anthropic: string;
  };
}

function loadFixtures(): Fixture[] {
  const dir = join(__dirname, 'fixtures', 'golden-set');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  return files.map((f) => {
    const raw = readFileSync(join(dir, f), 'utf-8');
    return JSON.parse(raw) as Fixture;
  });
}

function buildZodSchema(fixture: Fixture): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};
  for (const [key, def] of Object.entries(fixture.schema)) {
    let field: z.ZodType;
    switch (def.type) {
      case 'string':
        field = z.string().nullable();
        break;
      case 'number':
        field = z.number().nullable();
        break;
      case 'boolean':
        field = z.boolean().nullable();
        break;
      case 'array':
        field = z.array(z.unknown()).nullable();
        break;
      default:
        field = z.unknown().nullable();
    }
    shape[key] = field;
  }
  return z.object(shape);
}

function resetAndMockFixture(fixture: Fixture) {
  mockOpenAICreate.mockReset();
  mockAnthropicCreate.mockReset();

  let oaiCalls = 0;
  mockOpenAICreate.mockImplementation(async () => {
    oaiCalls++;
    return {
      choices: [{ message: { content: fixture.mockResponses.openai } }],
    };
  });

  mockAnthropicCreate.mockImplementation(async () => ({
    content: [{ type: 'text', text: fixture.mockResponses.anthropic }],
  }));
}

const fixtures = loadFixtures();

// ---------------------------------------------------------------------------
// Golden Set Calibration
// ---------------------------------------------------------------------------

describe('Golden Set Calibration', () => {
  it('has at least 18 fixtures loaded', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(18);
  });

  for (const fixture of fixtures) {
    it(`fixture "${fixture.id}" validates correctly`, async () => {
      resetAndMockFixture(fixture);
      const schema = buildZodSchema(fixture);

      const result = await extractWithConfidence(schema, fixture.extractedRawText);

      for (const [fieldName, expected] of Object.entries(fixture.expected)) {
        const fieldResult = result.fields[fieldName];
        expect(fieldResult, `Missing field: ${fieldName}`).toBeDefined();

        if (expected.value === null) {
          expect(
            fieldResult.value,
            `Field "${fieldName}" in fixture "${fixture.id}": expected null`,
          ).toBeNull();
          continue;
        }

        if (Array.isArray(expected.value)) {
          expect(
            fieldResult.value,
            `Field "${fieldName}" in fixture "${fixture.id}": array mismatch`,
          ).toEqual(expected.value);
        } else {
          expect(
            fieldResult.value,
            `Field "${fieldName}" in fixture "${fixture.id}": value mismatch`,
          ).toBe(expected.value);
        }

        expect(
          fieldResult.confidence,
          `Field "${fieldName}" in fixture "${fixture.id}": confidence ${fieldResult.confidence} < ${expected.minConfidence}`,
        ).toBeGreaterThanOrEqual(expected.minConfidence);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Calibration sanity checks (cross-fixture)
// ---------------------------------------------------------------------------

describe('Confidence calibration sanity', () => {
  it('perfect agreement fixture yields high confidence', async () => {
    const fixture = fixtures.find((f) => f.id === 'pricing-1-simple');
    if (!fixture) throw new Error('pricing-1-simple not found');
    resetAndMockFixture(fixture);
    const schema = buildZodSchema(fixture);

    const result = await extractWithConfidence(schema, fixture.extractedRawText);

    expect(result.meta.modelAgreement).toBeGreaterThanOrEqual(0.9);
    expect(result.fields.plan_name.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.fields.monthly_price.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('disagreement fixture shows lower confidence', async () => {
    const fixture = fixtures.find((f) => f.id === 'pricing-3-disagree');
    if (!fixture) throw new Error('pricing-3-disagree not found');
    resetAndMockFixture(fixture);
    const schema = buildZodSchema(fixture);

    const result = await extractWithConfidence(schema, fixture.extractedRawText);

    // plan_name disagrees → confidence should be lower
    expect(result.fields.plan_name.confidence).toBeLessThan(0.9);
    expect(result.fields.plan_name.status).toBe('needs_review');
    // price agrees perfectly
    expect(result.fields.monthly_price.value).toBe(19);
  });

  it('ambiguous fixture marks needs_review on disagreeing fields', async () => {
    const fixture = fixtures.find((f) => f.id === 'ambiguous-1-multiple-prices');
    if (!fixture) throw new Error('ambiguous-1-multiple-prices not found');
    resetAndMockFixture(fixture);
    const schema = buildZodSchema(fixture);

    const result = await extractWithConfidence(schema, fixture.extractedRawText);

    const statuses = Object.values(result.fields).map((f) => f.status);
    expect(statuses).toContain('needs_review');
  });

  it('confidence is never above 1.0', async () => {
    const fixture = fixtures.find((f) => f.id === 'pricing-1-simple');
    if (!fixture) throw new Error('pricing-1-simple not found');
    resetAndMockFixture(fixture);
    const schema = buildZodSchema(fixture);

    const result = await extractWithConfidence(schema, fixture.extractedRawText);

    for (const field of Object.values(result.fields)) {
      expect(field.confidence).toBeLessThanOrEqual(1.0);
    }
    expect(result.meta.modelAgreement).toBeLessThanOrEqual(1.0);
  });

  it('confidence is never below 0.0', async () => {
    const fixture = fixtures.find((f) => f.id === 'empty-1-blank-page');
    if (!fixture) throw new Error('empty-1-blank-page not found');
    resetAndMockFixture(fixture);
    const schema = buildZodSchema(fixture);

    const result = await extractWithConfidence(schema, fixture.extractedRawText);

    for (const field of Object.values(result.fields)) {
      expect(field.confidence).toBeGreaterThanOrEqual(0.0);
    }
    expect(result.meta.modelAgreement).toBeGreaterThanOrEqual(0.0);
  });

  it('retry fixture recovers from broken JSON', async () => {
    const fixture = fixtures.find((f) => f.id === 'retry-1-broken-json');
    if (!fixture) throw new Error('retry-1-broken-json not found');
    resetAndMockFixture(fixture);
    const schema = buildZodSchema(fixture);

    const result = await extractWithConfidence(schema, fixture.extractedRawText);

    expect(result.fields.plan_name.value).toBe('Starter');
    expect(result.fields.monthly_price.value).toBe(19);
  });

  it('wrong type fixture retries and recovers', async () => {
    const fixture = fixtures.find((f) => f.id === 'retry-2-wrong-type');
    if (!fixture) throw new Error('retry-2-wrong-type not found');
    resetAndMockFixture(fixture);
    const schema = buildZodSchema(fixture);

    const result = await extractWithConfidence(schema, fixture.extractedRawText);

    expect(result.fields.job_title.value).toBe('Data Engineer');
    expect(result.fields.location.value).toBe('Remote');
  });

  it('missing fields fixture returns null for absent data', async () => {
    const fixture = fixtures.find((f) => f.id === 'inconsistent-1-missing-fields');
    if (!fixture) throw new Error('inconsistent-1-missing-fields not found');
    resetAndMockFixture(fixture);
    const schema = buildZodSchema(fixture);

    const result = await extractWithConfidence(schema, fixture.extractedRawText);

    expect(result.fields.price.value).toBeNull();
    expect(result.fields.product_name.value).not.toBeNull();
    expect(result.fields.description.value).not.toBeNull();
  });

  it('extractionTimeMs is always positive', async () => {
    const fixture = fixtures.find((f) => f.id === 'pricing-1-simple');
    if (!fixture) throw new Error('pricing-1-simple not found');
    resetAndMockFixture(fixture);
    const schema = buildZodSchema(fixture);

    const result = await extractWithConfidence(schema, fixture.extractedRawText);

    expect(result.meta.extractionTimeMs).toBeGreaterThanOrEqual(0);
  });
});
