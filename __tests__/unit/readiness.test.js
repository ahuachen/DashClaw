import { describe, expect, it, vi } from 'vitest';

const { mockGetSetupStatus } = vi.hoisted(() => ({
  mockGetSetupStatus: vi.fn(),
}));

vi.mock('@/lib/setupStatus.mjs', () => ({
  getSetupStatus: mockGetSetupStatus,
}));

import { getReadinessReport, projectConnectNextStep, projectReadinessReport } from '@/lib/readiness.mjs';

describe('readiness projections', () => {
  it('projects a sign-in handoff when operator context is unavailable', () => {
    const step = projectConnectNextStep({
      isAuthenticated: false,
      verification: {
        overall: 'ready_unverified',
        ready: true,
      },
      onboarding: null,
      host: 'dashclaw.example.com',
    });

    expect(step.state).toBe('sign_in');
    expect(step.primaryCta.label).toBe('Sign in to continue');
    expect(step.primaryCta.href).toBe('/login');
  });

  it('projects a workspace handoff for authenticated users without a workspace', () => {
    const step = projectConnectNextStep({
      isAuthenticated: true,
      verification: {
        overall: 'ready_unverified',
        ready: true,
      },
      onboarding: {
        steps: {
          workspace_created: false,
          api_key_exists: false,
          first_action_sent: false,
        },
      },
      host: 'dashclaw.example.com',
    });

    expect(step.state).toBe('create_workspace');
    expect(step.primaryCta.label).toBe('Create workspace');
    expect(step.primaryCta.href).toBe('/dashboard');
  });

  it('projects an API key handoff when a workspace exists but no key is available', () => {
    const step = projectConnectNextStep({
      isAuthenticated: true,
      verification: {
        overall: 'ready_unverified',
        ready: true,
      },
      onboarding: {
        steps: {
          workspace_created: true,
          api_key_exists: false,
          first_action_sent: false,
        },
      },
      host: 'dashclaw.example.com',
    });

    expect(step.state).toBe('create_api_key');
    expect(step.primaryCta.label).toBe('Generate API key');
    expect(step.primaryCta.href).toBe('/api-keys');
  });

  it('projects a connect-agent handoff when an API key exists but no first action has been observed', () => {
    const step = projectConnectNextStep({
      isAuthenticated: true,
      verification: {
        overall: 'ready_unverified',
        ready: true,
      },
      onboarding: {
        steps: {
          workspace_created: true,
          api_key_exists: true,
          first_action_sent: false,
        },
      },
      host: 'dashclaw.example.com',
    });

    expect(step.state).toBe('connect_agent');
    expect(step.primaryCta.label).toBe('Open connect guide');
    expect(step.primaryCta.href).toBe('/connect');
    expect(step.secondaryCtas.map((cta) => cta.label)).toEqual(
      expect.arrayContaining(['Node starter', 'Python starter', 'Run validator'])
    );
    expect(step.statusItems.map((item) => item.label)).toEqual(
      expect.arrayContaining(['Workspace ready', 'API key ready', 'Waiting for first live action'])
    );
  });

  it('projects a connected handoff when the first action has already been observed', () => {
    const step = projectConnectNextStep({
      isAuthenticated: true,
      verification: {
        overall: 'verified',
        ready: true,
      },
      onboarding: {
        steps: {
          workspace_created: true,
          api_key_exists: true,
          first_action_sent: true,
        },
      },
      host: 'dashclaw.example.com',
    });

    expect(step.state).toBe('connected');
    expect(step.primaryCta.label).toBe('Open dashboard');
    expect(step.secondaryCtas.map((cta) => cta.href)).toEqual(
      expect.arrayContaining(['/pairings', '/policies'])
    );
  });

  it('redacts missing table names in the public view', async () => {
    mockGetSetupStatus.mockResolvedValue({
      configured: false,
      reason: 'no_tables',
      missing: ['users', 'guard_policies'],
      message: 'Missing tables.',
    });

    const report = await getReadinessReport({
      DATABASE_URL: 'postgres://db',
      NEXTAUTH_SECRET: 'secret',
      DASHCLAW_LOCAL_ADMIN_PASSWORD: 'password',
      NEXTAUTH_URL: 'https://dashclaw.example.com',
    });

    const publicView = projectReadinessReport(report, { isAuthenticated: false });
    const dbSchema = publicView.sections
      .find((section) => section.id === 'database')
      .checks.find((check) => check.id === 'db_schema');

    expect(dbSchema.detail).toContain('required table check');
    expect(dbSchema.subDetail).toContain('Sign in');
    expect(dbSchema.subDetail).not.toContain('users');
    expect(dbSchema.subDetail).not.toContain('guard_policies');
  });

  it('keeps exact missing table names in the authenticated operator view', async () => {
    mockGetSetupStatus.mockResolvedValue({
      configured: false,
      reason: 'no_tables',
      missing: ['users', 'guard_policies'],
      message: 'Missing tables.',
    });

    const report = await getReadinessReport({
      DATABASE_URL: 'postgres://db',
      NEXTAUTH_SECRET: 'secret',
      DASHCLAW_LOCAL_ADMIN_PASSWORD: 'password',
      NEXTAUTH_URL: 'https://dashclaw.example.com',
    });

    const operatorView = projectReadinessReport(report, { isAuthenticated: true });
    const dbSchema = operatorView.sections
      .find((section) => section.id === 'database')
      .checks.find((check) => check.id === 'db_schema');

    expect(dbSchema.subDetail).toContain('users');
    expect(dbSchema.subDetail).toContain('guard_policies');
  });

  it('redacts migration command details from the public recommendations', async () => {
    mockGetSetupStatus.mockResolvedValue({
      configured: false,
      reason: 'no_tables',
      missing: ['users'],
      message: 'Missing tables.',
    });

    const report = await getReadinessReport({
      DATABASE_URL: 'postgres://db',
      NEXTAUTH_SECRET: 'secret',
      DASHCLAW_LOCAL_ADMIN_PASSWORD: 'password',
      NEXTAUTH_URL: 'https://dashclaw.example.com',
    });

    const publicView = projectReadinessReport(report, { isAuthenticated: false });
    const step = publicView.recommendations.find((item) => item.id === 'run_migrations');

    expect(step.code).toBe('Sign in for the exact migration commands.');
    expect(step.note).toContain('required schema check');
  });

  it('marks strong operator-ready instances as ready but unverified until live proof is captured', async () => {
    mockGetSetupStatus.mockResolvedValue({
      configured: true,
      reason: 'ready',
      missing: [],
      message: 'Ready.',
    });

    const report = await getReadinessReport({
      DATABASE_URL: 'postgres://db',
      NEXTAUTH_SECRET: 'secret',
      NEXTAUTH_URL: 'https://dashclaw.example.com',
      DASHCLAW_LOCAL_ADMIN_PASSWORD: 'password',
      DASHCLAW_API_KEY: 'dc_test_key',
    });

    expect(report.verification.overall).toBe('ready_unverified');
    expect(report.verification.fullyVerified).toBe(false);
  });

  it('marks strong operator-ready instances as verified when live proof is attached', async () => {
    mockGetSetupStatus.mockResolvedValue({
      configured: true,
      reason: 'ready',
      missing: [],
      message: 'Ready.',
    });

    const report = await getReadinessReport(
      {
        DATABASE_URL: 'postgres://db',
        NEXTAUTH_SECRET: 'secret',
        NEXTAUTH_URL: 'https://dashclaw.example.com',
        DASHCLAW_LOCAL_ADMIN_PASSWORD: 'password',
        DASHCLAW_API_KEY: 'dc_test_key',
      },
      {
        host: 'dashclaw.example.com',
        liveProof: {
          tool: 'node',
          mode: 'full',
          capturedAt: '2026-03-13T12:00:00.000Z',
          summary: { passed: 13, failed: 0, skipped: 0, score: 100 },
          checks: [{ name: 'Health endpoint', status: 'pass' }],
          proofStatement: 'Node validator full validation passed with 13 successful check(s) and 0 skipped check(s).',
          verified: true,
        },
      }
    );

    expect(report.verification.overall).toBe('verified');
    expect(report.verification.fullyVerified).toBe(true);
    expect(report.sdk.hasLiveProof).toBe(true);
  });

  it('exposes a sanitized public proof artifact', async () => {
    mockGetSetupStatus.mockResolvedValue({
      configured: false,
      reason: 'no_tables',
      missing: ['users', 'guard_policies'],
      message: 'Missing tables.',
    });

    const report = await getReadinessReport(
      {
        DATABASE_URL: 'postgres://db',
        NEXTAUTH_SECRET: 'secret',
        NEXTAUTH_URL: 'https://dashclaw.example.com',
        DASHCLAW_LOCAL_ADMIN_PASSWORD: 'password',
        GITHUB_ID: 'github-client-id',
      },
      { host: 'dashclaw.example.com' }
    );

    const publicView = projectReadinessReport(report, {
      isAuthenticated: false,
      host: 'dashclaw.example.com',
    });
    const databaseCategory = publicView.proofArtifact.categories.find((category) => category.id === 'database');
    const authCategory = publicView.proofArtifact.categories.find((category) => category.id === 'auth');

    expect(publicView.proofArtifact.viewer_mode).toBe('public');
    expect(databaseCategory.checks.find((check) => check.id === 'db_schema').sub_detail).not.toContain('users');
    expect(authCategory.checks.find((check) => check.id === 'auth_github')?.sub_detail || '').not.toContain('GITHUB');
  });
});
