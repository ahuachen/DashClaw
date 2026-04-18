import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { publicHostedConfig } from '../../../app/lib/hosted/publicConfig.js';

describe('publicHostedConfig', () => {
  const original = { ...process.env };
  beforeEach(() => { process.env = { ...original }; });
  afterEach(() => { process.env = { ...original }; });

  it('returns hostedMode=false when DASHCLAW_HOSTED unset', () => {
    delete process.env.DASHCLAW_HOSTED;
    expect(publicHostedConfig()).toEqual({ hostedMode: false, turnstileSiteKey: null });
  });

  it('returns hostedMode=true when DASHCLAW_HOSTED=true', () => {
    process.env.DASHCLAW_HOSTED = 'true';
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    expect(publicHostedConfig()).toEqual({ hostedMode: true, turnstileSiteKey: null });
  });

  it('includes turnstileSiteKey when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set', () => {
    process.env.DASHCLAW_HOSTED = 'true';
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'site-key-abc';
    expect(publicHostedConfig()).toEqual({ hostedMode: true, turnstileSiteKey: 'site-key-abc' });
  });

  it('never exposes TURNSTILE_SECRET_KEY', () => {
    process.env.DASHCLAW_HOSTED = 'true';
    process.env.TURNSTILE_SECRET_KEY = 'secret-must-not-leak';
    const config = publicHostedConfig();
    expect(JSON.stringify(config)).not.toContain('secret-must-not-leak');
  });
});
