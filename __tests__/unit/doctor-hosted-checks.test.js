import { describe, expect, it } from 'vitest';
import { runChecks } from '@/lib/doctor/checks/hosted.mjs';

describe('doctor hosted checks', () => {
  it('skips hosted checks when DASHCLAW_HOSTED is disabled', async () => {
    const checks = await runChecks({ env: {} });

    expect(checks).toEqual([
      expect.objectContaining({
        id: 'hosted_mode_disabled',
        category: 'hosted',
        status: 'skipped',
      }),
    ]);
  });

  it('fails on missing hosted essentials and warns on missing cleanup/site key', async () => {
    const checks = await runChecks({ env: { DASHCLAW_HOSTED: 'true' } });

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'hosted_turnstile_secret', status: 'fail' }),
        expect.objectContaining({ id: 'hosted_cleanup_secret', status: 'warn' }),
        expect.objectContaining({ id: 'hosted_turnstile_site_key', status: 'warn' }),
      ])
    );
  });

  it('passes when hosted essentials are configured', async () => {
    const checks = await runChecks({
      env: {
        DASHCLAW_HOSTED: 'true',
        TURNSTILE_SECRET_KEY: 'secret',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-key',
        HOSTED_CLEANUP_SECRET: 'cleanup-secret',
      },
    });

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'hosted_turnstile_secret', status: 'pass' }),
        expect.objectContaining({ id: 'hosted_cleanup_secret', status: 'pass' }),
        expect.objectContaining({ id: 'hosted_turnstile_site_key', status: 'pass' }),
      ])
    );
  });
});
