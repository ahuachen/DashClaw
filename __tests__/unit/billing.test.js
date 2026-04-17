import { describe, it, expect } from 'vitest';
import { estimateCost, DEFAULT_PRICING } from '@/lib/billing.js';

describe('estimateCost', () => {
  it('returns 0 when model is missing (null/undefined/empty)', () => {
    // This is the fix for retroactive-Opus pricing on historical rows with
    // NULL model after the model-column migration. If we don't know the
    // model we refuse to guess rather than invent a number.
    expect(estimateCost(1_000_000, 1_000_000, null)).toBe(0);
    expect(estimateCost(1_000_000, 1_000_000, undefined)).toBe(0);
    expect(estimateCost(1_000_000, 1_000_000, '')).toBe(0);
  });

  it('prices known models via the default pricing table', () => {
    // Opus: $15/M in, $75/M out. 1M/1M tokens → $15 + $75 = $90.
    expect(estimateCost(1_000_000, 1_000_000, 'claude-opus-4-6')).toBeCloseTo(90, 5);
    // Sonnet: $3/M in, $15/M out. 1M/1M → $18.
    expect(estimateCost(1_000_000, 1_000_000, 'claude-sonnet-4-6')).toBeCloseTo(18, 5);
    // Haiku: $0.80/M in, $4/M out. 1M/1M → $4.80.
    expect(estimateCost(1_000_000, 1_000_000, 'haiku-4-5')).toBeCloseTo(4.80, 5);
  });

  it('falls back to the first pricing entry for unknown-but-present models', () => {
    // A present-but-unmapped model signals "unknown premium" — price it
    // conservatively via the first (Opus-tier) entry rather than 0.
    const opus = DEFAULT_PRICING[0];
    const expected = (1_000_000 * opus.input + 1_000_000 * opus.output) / 1_000_000;
    expect(estimateCost(1_000_000, 1_000_000, 'some-future-model-2099')).toBeCloseTo(expected, 5);
  });

  it('respects org-level custom pricing over defaults', () => {
    const custom = [{ pattern: 'my-model', input: 1, output: 2 }];
    expect(estimateCost(1_000_000, 1_000_000, 'my-model', custom)).toBeCloseTo(3, 5);
  });
});
