import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRateLimiter } from '../../../app/lib/hosted/rate-limit.js';

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T12:00:00Z'));
  });

  it('allows requests under the cap', () => {
    const rl = createRateLimiter({ max: 3, windowMs: 60_000 });
    expect(rl.take('1.1.1.1')).toEqual({ ok: true, remaining: 2 });
    expect(rl.take('1.1.1.1')).toEqual({ ok: true, remaining: 1 });
    expect(rl.take('1.1.1.1')).toEqual({ ok: true, remaining: 0 });
  });

  it('blocks requests over the cap', () => {
    const rl = createRateLimiter({ max: 2, windowMs: 60_000 });
    rl.take('1.1.1.1'); rl.take('1.1.1.1');
    const res = rl.take('1.1.1.1');
    expect(res.ok).toBe(false);
    expect(res.retryAfterMs).toBeGreaterThan(0);
  });

  it('is keyed per IP', () => {
    const rl = createRateLimiter({ max: 1, windowMs: 60_000 });
    expect(rl.take('1.1.1.1').ok).toBe(true);
    expect(rl.take('2.2.2.2').ok).toBe(true);
    expect(rl.take('1.1.1.1').ok).toBe(false);
  });

  it('resets after window elapses', () => {
    const rl = createRateLimiter({ max: 1, windowMs: 60_000 });
    expect(rl.take('1.1.1.1').ok).toBe(true);
    expect(rl.take('1.1.1.1').ok).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(rl.take('1.1.1.1').ok).toBe(true);
  });

  it('returns ok=true when ip is null/empty (fail open on missing IP — caller decides)', () => {
    const rl = createRateLimiter({ max: 1, windowMs: 60_000 });
    expect(rl.take(null).ok).toBe(true);
    expect(rl.take('').ok).toBe(true);
  });
});
