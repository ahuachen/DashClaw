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
});
