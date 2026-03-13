import { describe, expect, it, vi } from 'vitest';

const { mockGetSetupStatus } = vi.hoisted(() => ({
  mockGetSetupStatus: vi.fn(),
}));

vi.mock('@/lib/setupStatus.mjs', () => ({
  getSetupStatus: mockGetSetupStatus,
}));

import { getReadinessReport, projectReadinessReport } from '@/lib/readiness.mjs';

describe('readiness projections', () => {
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

  it('marks strong operator-ready instances as verified', async () => {
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

    expect(report.verification.overall).toBe('verified');
    expect(report.verification.fullyVerified).toBe(true);
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
