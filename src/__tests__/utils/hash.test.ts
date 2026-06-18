import { describe, it, expect } from 'vitest';
import { hashApiKey, generateApiKey } from '../../utils/hash';

describe('hashApiKey', () => {
  it('produces consistent hash', () => {
    const key = 'wi_test1234';
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    expect(hash1).toBe(hash2);
  });
  it('produces hex string', () => {
    const hash = hashApiKey('wi_test1234');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('generateApiKey', () => {
  it('starts with wi_', () => {
    const key = generateApiKey();
    expect(key.startsWith('wi_')).toBe(true);
  });
  it('generates unique keys', () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1).not.toBe(key2);
  });
});
