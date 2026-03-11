import { describe, expect, it } from 'vitest';
import { getAuthConfig, getMissingAuthMessage } from '@/lib/authConfig.mjs';

describe('authConfig helpers', () => {
  it('treats local admin password as a valid sign-in method', () => {
    const config = getAuthConfig({
      DASHCLAW_LOCAL_ADMIN_PASSWORD: 'super-secret-password',
    });

    expect(config.hasLocalPassword).toBe(true);
    expect(config.hasAnySignInMethod).toBe(true);
    expect(config.oauthProviders).toEqual([]);
  });

  it('lists configured OAuth providers', () => {
    const config = getAuthConfig({
      GITHUB_ID: 'github-id',
      GITHUB_SECRET: 'github-secret',
      OIDC_CLIENT_ID: 'oidc-client',
      OIDC_CLIENT_SECRET: 'oidc-secret',
      OIDC_ISSUER_URL: 'https://issuer.example.com',
      OIDC_DISPLAY_NAME: 'Authentik',
    });

    expect(config.hasAnyOAuth).toBe(true);
    expect(config.oauthProviders).toEqual([
      { id: 'github', name: 'GitHub' },
      { id: 'oidc', name: 'Authentik' },
    ]);
  });

  it('returns a clear missing-auth message', () => {
    expect(getMissingAuthMessage()).toContain('DASHCLAW_LOCAL_ADMIN_PASSWORD');
  });
});
