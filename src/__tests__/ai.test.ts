import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    CONFIDENCE_CALIBRATION_PATH: undefined,
  },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  })),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockOpenAICreate,
      },
    },
  })),
}));

import { extractWithConfidence, extractPromptOnly, askAI } from '../ai';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Dual-LLM agreement scoring
// ---------------------------------------------------------------------------

const SimpleSchema = z.object({
  name: z.string().describe('The name'),
  price: z.number().describe('The price in USD'),
});

describe('extractWithConfidence', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns high confidence when both providers agree exactly', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"name":"Acme","price":49}' } }],
    });
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"name":"Acme","price":49}' }],
    });

    const result = await extractWithConfidence(SimpleSchema, 'Acme costs $49');

    expect(result.fields.name.value).toBe('Acme');
    expect(result.fields.name.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.fields.name.status).toBe('ok');
    expect(result.fields.price.value).toBe(49);
    expect(result.fields.price.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.fields.price.status).toBe('ok');
    expect(result.meta.modelAgreement).toBeGreaterThanOrEqual(0.9);
    expect(result.meta.extractionTimeMs).toBeGreaterThan(0);
  });

  it('returns moderate confidence when providers disagree on string', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"name":"Starter","price":19}' } }],
    });
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"name":"Starter Plan","price":19}' }],
    });

    const result = await extractWithConfidence(SimpleSchema, 'Starter Plan $19');

    expect(result.fields.name.status).toBe('needs_review');
    expect(result.meta.modelAgreement).toBeLessThan(1.0);
  });

  it('returns low confidence when providers disagree on numeric value', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"name":"Pro","price":49}' } }],
    });
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"name":"Pro","price":99}' }],
    });

    const result = await extractWithConfidence(SimpleSchema, 'Pro plan');

    expect(result.fields.price.confidence).toBeLessThan(0.7);
    expect(result.meta.modelAgreement).toBeLessThan(0.7);
  });

  it('handles when both providers agree a field is null', async () => {
    const NullableSchema = z.object({
      name: z.string(),
      phone: z.string().nullable(),
    });

    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"name":"Company","phone":null}' } }],
    });
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"name":"Company","phone":null}' }],
    });

    const result = await extractWithConfidence(NullableSchema, 'Company with no phone');

    expect(result.fields.phone.value).toBeNull();
    expect(result.fields.phone.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.fields.phone.status).toBe('ok');
  });

  it('marks needs_review when one provider has null and other has value', async () => {
    const NullableSchema = z.object({
      name: z.string(),
      phone: z.string().nullable(),
    });

    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"name":"Company","phone":"+1-555-0100"}' } }],
    });
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"name":"Company","phone":null}' }],
    });

    const result = await extractWithConfidence(NullableSchema, 'Company');

    expect(result.fields.phone.confidence).toBeLessThan(0.5);
    expect(result.fields.phone.status).toBe('needs_review');
  });

  it('works with only one provider configured (mocked as both available)', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"name":"Solo","price":10}' } }],
    });
    const result = await extractWithConfidence(SimpleSchema, 'Solo $10');
    expect(result.fields.name.value).toBe('Solo');
  });

  it('handles array fields with agreement', async () => {
    const ArraySchema = z.object({
      features: z.array(z.string()),
    });

    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"features":["A","B","C"]}' } }],
    });
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"features":["A","B","C"]}' }],
    });

    const result = await extractWithConfidence(ArraySchema, 'Features: A, B, C');

    expect(result.fields.features.value).toEqual(['A', 'B', 'C']);
    expect(result.fields.features.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('handles array partial agreement', async () => {
    const ArraySchema = z.object({
      features: z.array(z.string()),
    });

    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"features":["A","B","C"]}' } }],
    });
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"features":["A","B","D"]}' }],
    });

    const result = await extractWithConfidence(ArraySchema, 'Features: A, B, C, D');

    expect(result.fields.features.confidence).toBeLessThan(1.0);
    expect(result.meta.modelAgreement).toBeLessThan(1.0);
  });

  it('handles empty arrays as agreement', async () => {
    const ArraySchema = z.object({
      features: z.array(z.string()),
    });

    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"features":[]}' } }],
    });
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"features":[]}' }],
    });

    const result = await extractWithConfidence(ArraySchema, 'No features');

    expect(result.fields.features.value).toEqual([]);
    expect(result.fields.features.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('retries on invalid JSON once then succeeds', async () => {
    // First attempt: broken JSON
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"name":"Retry", "price": 19' } }],
    });
    // Retry attempt: valid JSON
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"name":"Retry","price":19}' } }],
    });
    // Anthropic produces valid JSON
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"name":"Retry","price":19}' }],
    });

    const result = await extractWithConfidence(SimpleSchema, 'Retry $19');

    expect(result.fields.name.value).toBe('Retry');
    expect(result.fields.price.value).toBe(19);
  });

  it('marks needs_review when retry also fails', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'not json at all' } }],
    });
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'still not json' } }],
    });
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"name":"Works","price":19}' }],
    });

    const result = await extractWithConfidence(SimpleSchema, 'Works $19');

    expect(result.fields.name.value).toBe('Works');
    expect(result.fields.price.value).toBe(19);
    expect(result.fields.name.source_providers).toEqual(['anthropic']);
    expect(result.fields.price.source_providers).toEqual(['anthropic']);
  });

  it('wraps JSON in markdown fences', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: '```json\n{"name":"Fenced","price":29}\n```' } }],
    });
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"name":"Fenced","price":29}' }],
    });

    const result = await extractWithConfidence(SimpleSchema, 'Fenced $29');

    expect(result.fields.name.value).toBe('Fenced');
    expect(result.fields.price.value).toBe(29);
  });

  it('handles both providers returning valid JSON wrapped differently', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Here is the data:\n```json\n{"name":"Wrapped","price":39}\n```' } }],
    });
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Based on the content: {"name":"Wrapped","price":39}' }],
    });

    const result = await extractWithConfidence(SimpleSchema, 'Wrapped $39');

    expect(result.fields.name.value).toBe('Wrapped');
    expect(result.fields.price.value).toBe(39);
    expect(result.fields.name.confidence).toBeGreaterThanOrEqual(0.9);
  });
});

// ---------------------------------------------------------------------------
// askAI — backwards compatibility
// ---------------------------------------------------------------------------

describe('askAI (backwards compatibility)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('still works as before for json format', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"result":"ok"}' } }],
    });

    const result = await askAI<{ result: string }>('sys', 'prompt', 'json');

    expect(result).toEqual({ result: 'ok' });
  });

  it('still works as before for text format', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'plain text response' } }],
    });

    const result = await askAI<string>('sys', 'prompt', 'text');

    expect(result).toBe('plain text response');
  });

  it('falls back to Anthropic when OpenAI fails', async () => {
    mockOpenAICreate.mockRejectedValueOnce(new Error('OpenAI down'));
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"fallback":"yes"}' }],
    });

    const result = await askAI<{ fallback: string }>('sys', 'prompt', 'json');

    expect(result).toEqual({ fallback: 'yes' });
  });
});

// ---------------------------------------------------------------------------
// extractPromptOnly — natural language extraction
// ---------------------------------------------------------------------------

describe('extractPromptOnly', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('extracts data from natural-language instruction', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"company":"Acme","value":"$50M"}' } }],
    });
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"company":"Acme","value":"$50M"}' }],
    });

    const result = await extractPromptOnly(
      'Extract the company name and valuation',
      'Acme Corp raised $50M in Series A',
    );

    expect(result.fields.company.value).toBe('Acme');
    expect(result.fields.value.value).toBe('$50M');
    expect(result.meta.modelAgreement).toBeGreaterThanOrEqual(0.9);
  });

  it('works with single provider', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"title":"Hello"}' } }],
    });
    const result = await extractPromptOnly('Get the title', 'Content: Hello World');

    expect(result.fields.title.value).toBe('Hello');
    expect(result.fields.title.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.fields.title.status).toBe('ok');
  });

  it('handles no successful providers', async () => {
    mockOpenAICreate.mockRejectedValue(new Error('fail'));
    mockAnthropicCreate.mockRejectedValue(new Error('fail'));

    const result = await extractPromptOnly('Extract data', 'some content');

    expect(result.fields).toEqual({});
    expect(result.meta.modelAgreement).toBe(0);
  });
});
