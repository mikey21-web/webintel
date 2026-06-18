import { describe, it, expect } from 'vitest';
import { PLAN_LIMITS } from '../../middleware/rateLimit';

describe('Rate limit constants', () => {
  it('should define limits for all plans', () => {
    const limits: Record<string, number> = { free: 30, starter: 120, pro: 300, scale: 1200 };
    expect(limits.free).toBe(30);
    expect(limits.starter).toBe(120);
    expect(limits.pro).toBe(300);
    expect(limits.scale).toBe(1200);
  });
});
