import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config', () => ({
  config: {
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_JWK: null,
    SUPABASE_JWT_SECRET: null,
    SCOPED_JWT_SECRET: 'test-secret',
  },
}));

import { parseUnsafe, isAnonKey } from '../../utils/jwt';

describe('parseUnsafe', () => {
  it('parses valid JWT payload', () => {
    const header = btoa(JSON.stringify({ alg: 'HS256' }));
    const payload = btoa(JSON.stringify({ sub: 'user123', email: 'test@test.com' }));
    const token = `${header}.${payload}.signature`;
    const result = parseUnsafe(token);
    expect(result).not.toBeNull();
    expect(result!.sub).toBe('user123');
  });
  it('returns null for invalid token', () => {
    expect(parseUnsafe('not-a-jwt')).toBeNull();
  });
  it('returns null for token without sub', () => {
    const header = btoa(JSON.stringify({ alg: 'HS256' }));
    const payload = btoa(JSON.stringify({ foo: 'bar' }));
    const token = `${header}.${payload}.signature`;
    expect(parseUnsafe(token)).toBeNull();
  });
});
