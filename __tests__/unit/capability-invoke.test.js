import { describe, expect, it, vi, beforeEach } from 'vitest';
import { invokeCapability, resolveAuth, RISK_SCORE_MAP } from '../../app/lib/capability-invoke.js';

describe('RISK_SCORE_MAP', () => {
  it('maps risk levels to scores', () => {
    expect(RISK_SCORE_MAP.low).toBe(20);
    expect(RISK_SCORE_MAP.medium).toBe(50);
    expect(RISK_SCORE_MAP.high).toBe(75);
    expect(RISK_SCORE_MAP.critical).toBe(95);
  });
});

describe('resolveAuth', () => {
  it('returns bearer header when auth type is bearer', () => {
    const auth = { type: 'bearer', token_setting: 'MY_TOKEN' };
    const settings = { MY_TOKEN: 'secret123' };
    expect(resolveAuth(auth, settings)).toEqual({
      Authorization: 'Bearer secret123',
    });
  });

  it('returns api_key header when auth type is api_key', () => {
    const auth = { type: 'api_key', token_setting: 'MY_KEY' };
    const settings = { MY_KEY: 'key123' };
    expect(resolveAuth(auth, settings)).toEqual({
      'x-api-key': 'key123',
    });
  });

  it('returns empty object when auth type is none', () => {
    expect(resolveAuth({ type: 'none' }, {})).toEqual({});
    expect(resolveAuth(null, {})).toEqual({});
  });

  it('throws when token setting not found', () => {
    const auth = { type: 'bearer', token_setting: 'MISSING' };
    expect(() => resolveAuth(auth, {})).toThrow('auth_not_configured');
  });
});

describe('invokeCapability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('calls endpoint with mapped request and returns mapped response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ answer: 'result', elapsedMs: 100 }),
    });

    const result = await invokeCapability({
      endpoint: 'http://localhost:3849/v1/research',
      method: 'POST',
      authHeaders: { Authorization: 'Bearer token' },
      body: { query: 'test' },
      requestMapping: { query: '$.query' },
      responseMapping: { answer: '$.answer', elapsed_ms: '$.elapsedMs' },
      timeoutMs: 5000,
    });

    expect(result.success).toBe(true);
    expect(result.data.answer).toBe('result');
    expect(result.data.elapsed_ms).toBe(100);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3849/v1/research',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    );
  });

  it('returns failure on downstream error', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const result = await invokeCapability({
      endpoint: 'http://example.com/api',
      method: 'POST',
      authHeaders: {},
      body: {},
      requestMapping: null,
      responseMapping: null,
      timeoutMs: 5000,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('capability_error');
    expect(result.status).toBe(500);
  });

  it('returns failure on timeout', async () => {
    global.fetch.mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });

    const result = await invokeCapability({
      endpoint: 'http://example.com/api',
      method: 'POST',
      authHeaders: {},
      body: {},
      requestMapping: null,
      responseMapping: null,
      timeoutMs: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('capability_timeout');
  });
});
