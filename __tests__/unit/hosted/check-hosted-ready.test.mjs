import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assessHostedReadiness } from '../../../scripts/check-hosted-ready.mjs';

describe('assessHostedReadiness', () => {
  const original = { ...process.env };
  beforeEach(() => { process.env = { ...original }; });
  afterEach(() => { process.env = { ...original }; });

  it('returns skipped when DASHCLAW_HOSTED is unset', () => {
    delete process.env.DASHCLAW_HOSTED;
    const r = assessHostedReadiness();
    expect(r.status).toBe('skipped');
    expect(r.failures).toEqual([]);
  });

  it('passes when all required vars are set', () => {
    process.env.DASHCLAW_HOSTED = 'true';
    process.env.DATABASE_URL = 'postgres://user:pw@host/db';
    process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret';
    process.env.DASHCLAW_API_KEY = 'oc_live_admin_key_1234567890abcdef1234567890abcdef';
    const r = assessHostedReadiness();
    expect(r.status).toBe('ok');
    expect(r.failures).toEqual([]);
  });

  it('fails loudly when TURNSTILE_SECRET_KEY is missing in hosted mode', () => {
    process.env.DASHCLAW_HOSTED = 'true';
    process.env.DATABASE_URL = 'postgres://fake';
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.DASHCLAW_API_KEY = 'oc_live_admin_key_1234567890abcdef1234567890abcdef';
    const r = assessHostedReadiness();
    expect(r.status).toBe('fail');
    expect(r.failures).toContain('TURNSTILE_SECRET_KEY missing');
  });

  it('warns when HOSTED_CLEANUP_SECRET and CRON_SECRET are both unset', () => {
    process.env.DASHCLAW_HOSTED = 'true';
    process.env.DATABASE_URL = 'postgres://fake';
    process.env.TURNSTILE_SECRET_KEY = 'x';
    process.env.DASHCLAW_API_KEY = 'oc_live_admin_key_1234567890abcdef1234567890abcdef';
    delete process.env.HOSTED_CLEANUP_SECRET;
    delete process.env.CRON_SECRET;
    const r = assessHostedReadiness();
    expect(r.warnings).toContain('no cleanup secret configured (HOSTED_CLEANUP_SECRET or CRON_SECRET) — cleanup route is admin-only');
  });

  it('fails on DATABASE_URL missing', () => {
    process.env.DASHCLAW_HOSTED = 'true';
    delete process.env.DATABASE_URL;
    const r = assessHostedReadiness();
    expect(r.status).toBe('fail');
    expect(r.failures).toContain('DATABASE_URL missing');
  });

  it('fails when DASHCLAW_API_KEY is missing or malformed', () => {
    process.env.DASHCLAW_HOSTED = 'true';
    process.env.DATABASE_URL = 'postgres://fake';
    process.env.TURNSTILE_SECRET_KEY = 'x';
    delete process.env.DASHCLAW_API_KEY;
    const r = assessHostedReadiness();
    expect(r.status).toBe('fail');
    expect(r.failures).toContain('DASHCLAW_API_KEY missing');
  });
});
