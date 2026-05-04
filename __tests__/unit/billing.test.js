import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { estimateCost } from '@/lib/billing.js';

describe('estimateCost', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns 0 when model is missing (null/undefined/empty)', () => {
    // If we don't know the model we refuse to guess rather than invent a number —
    // a wrong guess retroactively prices every null-model row and poisons analytics.
    expect(estimateCost(1_000_000, 1_000_000, null)).toBe(0);
    expect(estimateCost(1_000_000, 1_000_000, undefined)).toBe(0);
    expect(estimateCost(1_000_000, 1_000_000, '')).toBe(0);
  });

  it('prices known models via the default pricing table', () => {
    expect(estimateCost(1_000_000, 1_000_000, 'claude-opus-4-6')).toBeCloseTo(90, 5);
    expect(estimateCost(1_000_000, 1_000_000, 'claude-sonnet-4-6')).toBeCloseTo(18, 5);
    expect(estimateCost(1_000_000, 1_000_000, 'haiku-4-5')).toBeCloseTo(4.80, 5);
  });

  it('returns 0 for unknown-but-present models and warns once per model', () => {
    // Prior behavior priced unknown models at Opus-tier rates as a "conservative
    // over-estimate", which inflated cheap open-source models ~1000x and poisoned
    // cost dashboards. Unknown now surfaces as $0 + an observable warn.
    expect(estimateCost(1_000_000, 1_000_000, 'some-future-model-2099')).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][1]).toBe('some-future-model-2099');
    // Second call for the same model should not re-warn.
    expect(estimateCost(500, 500, 'some-future-model-2099')).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('respects org-level custom pricing over defaults', () => {
    const custom = [{ pattern: 'my-model', input: 1, output: 2 }];
    expect(estimateCost(1_000_000, 1_000_000, 'my-model', custom)).toBeCloseTo(3, 5);
  });
});
