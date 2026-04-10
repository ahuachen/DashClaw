import { describe, expect, it } from 'vitest';
import { PLAN_LIMITS, calculateQuotaStatus } from '../../app/lib/usage.js';

describe('PLAN_LIMITS', () => {
  it('defines four tiers', () => {
    expect(Object.keys(PLAN_LIMITS)).toEqual(['free', 'pro', 'business', 'enterprise']);
  });

  it('all tiers have Infinity for all resources (open-source, no limits)', () => {
    for (const tier of Object.values(PLAN_LIMITS)) {
      for (const value of Object.values(tier)) {
        expect(value).toBe(Infinity);
      }
    }
  });
});

describe('calculateQuotaStatus', () => {
  it('returns allowed with no warning under 80%', () => {
    const result = calculateQuotaStatus(3000, 5000);
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeNull();
  });

  it('returns approaching warning at 80-100%', () => {
    const result = calculateQuotaStatus(4200, 5000);
    expect(result.allowed).toBe(true);
    expect(result.warning.level).toBe('approaching');
    expect(result.warning.percentage).toBe(84);
  });

  it('returns grace warning at 100-110%', () => {
    const result = calculateQuotaStatus(5200, 5000);
    expect(result.allowed).toBe(true);
    expect(result.warning.level).toBe('grace');
  });

  it('blocks at over 110%', () => {
    const result = calculateQuotaStatus(5600, 5000);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('quota_exceeded');
  });

  it('always allows Infinity limits', () => {
    const result = calculateQuotaStatus(999999, Infinity);
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeNull();
  });

  it('returns correct usage and limit in warning', () => {
    const result = calculateQuotaStatus(4500, 5000);
    expect(result.warning.usage).toBe(4500);
    expect(result.warning.limit).toBe(5000);
  });
});
