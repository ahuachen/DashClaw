import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyTurnstile } from '../../../app/lib/hosted/turnstile.js';

describe('verifyTurnstile', () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env = { ...original };
    vi.restoreAllMocks();
  });
  afterEach(() => { process.env = { ...original }; });

  it('returns { ok: true, bypassed: true } when TURNSTILE_SECRET_KEY unset (dev)', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const res = await verifyTurnstile('any-token', '1.1.1.1');
    expect(res).toEqual({ ok: true, bypassed: true });
  });

  it('refuses to bypass in production when TURNSTILE_SECRET_KEY unset', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.NODE_ENV = 'production';
    const res = await verifyTurnstile('any-token', '1.1.1.1');
    expect(res).toEqual({ ok: false, reason: 'unconfigured' });
  });

  it('returns { ok: false, reason: "missing_token" } for empty token in production', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    const res = await verifyTurnstile('', '1.1.1.1');
    expect(res).toEqual({ ok: false, reason: 'missing_token' });
  });

  it('calls Cloudflare siteverify and returns ok when success=true', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    const res = await verifyTurnstile('tok-abc', '1.1.1.1');
    expect(res).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns { ok: false, reason: "cf_rejected", errors } when success=false', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    });
    const res = await verifyTurnstile('tok', '1.1.1.1');
    expect(res).toEqual({ ok: false, reason: 'cf_rejected', errors: ['invalid-input-response'] });
  });

  it('fails closed on network error', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const res = await verifyTurnstile('tok', '1.1.1.1');
    expect(res).toEqual({ ok: false, reason: 'verify_failed' });
  });
});
