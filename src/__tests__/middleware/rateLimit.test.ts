import { describe, it, expect, vi } from 'vitest';

vi.mock('../../queue/setup', () => ({
  connection: {},
}));

import { PLAN_LIMITS } from '../../middleware/rateLimit';

describe('Rate limit constants', () => {
  it('should define limits for all plans', () => {
    expect(PLAN_LIMITS).toHaveProperty('free');
    expect(PLAN_LIMITS).toHaveProperty('starter');
    expect(PLAN_LIMITS).toHaveProperty('pro');
    expect(PLAN_LIMITS).toHaveProperty('scale');
  });

  it('should have monotonically non-decreasing limits', () => {
    expect(PLAN_LIMITS.free).toBeLessThanOrEqual(PLAN_LIMITS.starter);
    expect(PLAN_LIMITS.starter).toBeLessThanOrEqual(PLAN_LIMITS.pro);
    expect(PLAN_LIMITS.pro).toBeLessThanOrEqual(PLAN_LIMITS.scale);
  });

  it('should have positive limits', () => {
    for (const limit of Object.values(PLAN_LIMITS)) {
      expect(limit).toBeGreaterThan(0);
    }
  });
});
