import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockDbSelect,
  mockDbInsert,
  mockDbValues,
  mockDbReturning,
  mockDbUpdate,
  mockDbSet,
  mockDbWhere,
  mockDbDelete,
  mockExtractWithConfidence,
} = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbValues: vi.fn(),
  mockDbReturning: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbSet: vi.fn(),
  mockDbWhere: vi.fn(),
  mockDbDelete: vi.fn(),
  mockExtractWithConfidence: vi.fn(),
}));

vi.mock('../../config', () => ({
  config: {
    PORT: 3456, NODE_ENV: 'test', DATABASE_URL: 'postgres://test', REDIS_URL: 'redis://test',
    ANTHROPIC_API_KEY: 'test-key', OPENAI_API_KEY: 'test-key',
    SCOPED_JWT_SECRET: 'test-jwt-secret-32chars!!', WEBHOOK_SECRET: 'test-wh-secret-32chars!!',
    APP_URL: 'http://localhost:3456', CRAWL4AI_SIDECAR_URL: 'http://localhost:8765',
    R2_BUCKET_NAME: 'test-bucket', R2_PUBLIC_URL: '',
    OPENAI_MODEL: 'gpt-4o', ANTHROPIC_MODEL: 'claude-sonnet-4-20250514',
  },
}));

vi.mock('../../db/client', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
  },
}));

vi.mock('../../db/schema', () => ({
  extractionContracts: { id: Symbol('contracts'), userId: Symbol('userId'), url: Symbol('url'), name: Symbol('name') },
  extractionRuns: { id: Symbol('runs'), contractId: Symbol('contractId'), extractedAt: Symbol('extractedAt') },
}));

vi.mock('../../ai', () => ({
  extractWithConfidence: mockExtractWithConfidence,
  getZodTypeName: (f: any) => { try { return f._def?.typeName?.replace('Zod','').toLowerCase() ?? 'string' } catch { return 'string' } },
  compareValues: () => 1.0,
  shapeConformance: () => 1.0,
}));

vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args }),
  desc: (col: any) => ({ type: 'desc', col }),
}));

import {
  captureContract,
  validateContract,
  healContract,
  listContracts,
  getContract,
  getContractRuns,
  deleteContract,
} from '../../extraction/contracts';

const contractRow = {
  id: 'c1', userId: 'u1', url: 'https://acme.com/pricing', name: null,
  schema: { fields: { name: { type: 'string', nullable: false }, price: { type: 'number', nullable: false } } },
  fingerprint: {
    name: { type: 'string', nullable: false, sampleValues: ['Acme'] },
    price: { type: 'number', nullable: false, sampleValues: [49], min: 49, max: 49, isInteger: true },
  },
  semanticAnchors: [],
  provenance: [{ timestamp: '2026-01-01T00:00:00Z', contentHash: 'abc123', sourceUrl: 'https://acme.com/pricing', sourceSnippets: {}, fields: { name: 'Acme', price: 49 }, healed: false }],
  lastHealedAt: null, lastRunAt: null, runCount: 1, active: true,
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
};

function mockSelectQuery(rows: any[]) {
  const limitChain = vi.fn().mockReturnValue(rows);
  const chain = {
    where: () => chain,
    orderBy: () => chain,
    limit: limitChain,
  };
  mockDbSelect.mockReturnValue({ from: () => chain });
  return limitChain;
}

describe('captureContract', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('creates a new contract when none exists', async () => {
    mockSelectQuery([]);
    const returningMock = vi.fn()
      .mockResolvedValueOnce([{ id: 'c1' }])
      .mockResolvedValueOnce([{ id: 'r1' }]);
    mockDbInsert.mockReturnValue({ values: mockDbValues });
    mockDbValues.mockReturnValue({ returning: returningMock });

    const result = await captureContract({
      userId: 'u1', url: 'https://acme.com/pricing',
      schema: { fields: { name: { type: 'string', nullable: false }, price: { type: 'number', nullable: false } } },
      values: { name: 'Acme', price: 49 },
      sourceSnippets: {}, confidence: { name: 0.95, price: 0.98 }, contentHash: 'abc123',
    });

    expect(result.isNew).toBe(true);
    expect(result.contractId).toBe('c1');
  });

  it('updates existing contract on subsequent extraction', async () => {
    mockSelectQuery([contractRow]);
    mockDbUpdate.mockReturnValue({ set: mockDbSet });
    mockDbSet.mockReturnValue({ where: mockDbWhere });
    mockDbInsert.mockReturnValue({ values: mockDbValues });
    mockDbValues.mockReturnValue({ returning: vi.fn().mockResolvedValueOnce([{ id: 'r2' }]) });

    const result = await captureContract({
      userId: 'u1', url: 'https://acme.com/pricing',
      schema: { fields: { name: { type: 'string' }, price: { type: 'number' } } },
      values: { name: 'Acme', price: 49 },
      sourceSnippets: {}, confidence: { name: 0.9, price: 0.95 }, contentHash: 'def456',
    });

    expect(result.isNew).toBe(false);
    expect(result.contractId).toBe('c1');
    expect(mockDbUpdate).toHaveBeenCalled();
  });
});

describe('validateContract', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns ok when all fields match', async () => {
    mockSelectQuery([contractRow]);
    mockDbInsert.mockReturnValue({ values: mockDbValues });
    mockDbValues.mockReturnValue({ returning: vi.fn().mockResolvedValueOnce([{ id: 'r1' }]) });

    const result = await validateContract('c1', { name: 'Acme', price: 49 }, 'abc123');

    expect(result.status).toBe('ok');
    expect(result.needsHealing).toHaveLength(0);
  });

  it('detects drifted fields', async () => {
    mockSelectQuery([contractRow]);
    mockDbInsert.mockReturnValue({ values: mockDbValues });
    mockDbValues.mockReturnValue({ returning: vi.fn().mockResolvedValueOnce([{ id: 'r2' }]) });

    const result = await validateContract('c1', { name: 'Something Different That Def Violates Long', price: 9999999 }, 'xyz');

    expect(result.status).toBe('drifted');
    expect(result.needsHealing).toContain('price');
  });

  it('throws if contract not found', async () => {
    mockSelectQuery([]);
    await expect(validateContract('bad-id', { name: 'A', price: 1 }, 'hash')).rejects.toThrow('Contract bad-id not found');
  });
});

describe('healContract', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('heals drifted fields via AI rediscovery', async () => {
    mockSelectQuery([contractRow]);
    mockExtractWithConfidence.mockResolvedValueOnce({
      fields: {
        name: { value: 'Acme Updated', confidence: 0.9, status: 'ok', source_providers: ['anthropic'] },
        price: { value: 79, confidence: 0.85, status: 'ok', source_providers: ['anthropic'] },
      },
      meta: { modelAgreement: 0.9, extractionTimeMs: 500 },
    });
    mockDbUpdate.mockReturnValue({ set: mockDbSet });
    mockDbSet.mockReturnValue({ where: mockDbWhere });
    mockDbInsert.mockReturnValue({ values: mockDbValues });
    mockDbValues.mockReturnValue({ returning: vi.fn().mockResolvedValueOnce([{ id: 'r_heal' }]) });

    const result = await healContract('c1', ['name', 'price'], 'Updated content');

    expect(result.status).toBe('healed');
    expect(result.healedFields).toContain('name');
    expect(result.healedFields).toContain('price');
    expect(result.diff.name).toBeDefined();
    expect(mockExtractWithConfidence).toHaveBeenCalled();
  });

  it('marks needs_review when rediscovery fails', async () => {
    mockSelectQuery([contractRow]);
    mockExtractWithConfidence.mockRejectedValueOnce(new Error('AI timeout'));
    mockDbUpdate.mockReturnValue({ set: mockDbSet });
    mockDbSet.mockReturnValue({ where: mockDbWhere });
    mockDbInsert.mockReturnValue({ values: mockDbValues });
    mockDbValues.mockReturnValue({ returning: vi.fn().mockResolvedValueOnce([{ id: 'r_fail' }]) });

    const result = await healContract('c1', ['name'], 'content');

    expect(result.status).toBe('needs_review');
    expect(result.healedFields).toHaveLength(0);
  });
});

describe('CRUD operations', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('listContracts returns user contracts', async () => {
    const chain = { where: () => ({ orderBy: () => Promise.resolve([contractRow]) }) };
    mockDbSelect.mockReturnValue({ from: () => chain });

    const result = await listContracts('u1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });

  it('getContract returns single contract', async () => {
    mockSelectQuery([contractRow]);
    const result = await getContract('c1', 'u1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('c1');
  });

  it('getContract returns null for non-existent', async () => {
    mockSelectQuery([]);
    const result = await getContract('bad', 'u1');
    expect(result).toBeNull();
  });

  it('getContractRuns returns run history', async () => {
    const chain = {
      where: () => ({
        orderBy: () => ({
          limit: () => ({
            offset: () => Promise.resolve([{ id: 'r1', status: 'ok' }]),
          }),
        }),
      }),
    };
    mockDbSelect.mockReturnValue({ from: () => chain });

    const result = await getContractRuns('c1', 10, 0);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });

  it('deleteContract removes contract', async () => {
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([contractRow]) }),
    });
    const result = await deleteContract('c1', 'u1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('c1');
  });

  it('deleteContract returns null for non-existent', async () => {
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    });
    const result = await deleteContract('bad', 'u1');
    expect(result).toBeNull();
  });
});
