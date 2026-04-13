// __tests__/unit/doctor-shape-checks.test.js
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSetupStatus, mockGetSql } = vi.hoisted(() => ({
  mockGetSetupStatus: vi.fn(),
  mockGetSql: vi.fn(),
}));

vi.mock('@/lib/setupStatus.mjs', () => ({ getSetupStatus: mockGetSetupStatus }));
vi.mock('@/lib/db.js', () => ({ getSql: mockGetSql }));

import { runShapeChecks } from '@/lib/doctor/generated/checks-from-shape.mjs';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSetupStatus.mockResolvedValue({ configured: false });
});

describe('doctor/generated/runShapeChecks', () => {
  it('emits env checks even when the database is unreachable', async () => {
    const checks = await runShapeChecks({ env: {} });

    const envChecks = checks.filter((c) => c.id.startsWith('shape_env_'));
    expect(envChecks.length).toBeGreaterThan(0);
    expect(envChecks.every((c) => c.category === 'shape')).toBe(true);

    // DATABASE_URL is the classic no-fix case — message should direct to manual.
    const dbUrl = checks.find((c) => c.id === 'shape_env_DATABASE_URL');
    expect(dbUrl).toBeDefined();
    expect(dbUrl.status).toBe('fail');
    expect(dbUrl.fix).toBeNull();
  });

  it('marks fixable env vars with their fix action when unset', async () => {
    const checks = await runShapeChecks({ env: {} });

    const nextAuth = checks.find((c) => c.id === 'shape_env_NEXTAUTH_SECRET');
    expect(nextAuth.status).toBe('fail');
    expect(nextAuth.fix).toEqual({
      type: 'auto',
      description: expect.any(String),
      action: 'generate_secret',
    });

    const apiKey = checks.find((c) => c.id === 'shape_env_DASHCLAW_API_KEY');
    expect(apiKey.fix?.action).toBe('generate_api_key');
  });

  it('marks env var as passing when set', async () => {
    const checks = await runShapeChecks({ env: { NEXTAUTH_SECRET: 'abc' } });
    const nextAuth = checks.find((c) => c.id === 'shape_env_NEXTAUTH_SECRET');
    expect(nextAuth.status).toBe('pass');
    expect(nextAuth.fix).toBeNull();
  });

  it('adds a shape_table_* check per table when the DB is reachable', async () => {
    mockGetSetupStatus.mockResolvedValue({ configured: true });
    const sqlImpl = Object.assign(vi.fn(), {
      unsafe: vi.fn().mockResolvedValue([{ oid: 'public.guard_policies' }]),
    });
    mockGetSql.mockReturnValue(sqlImpl);

    const checks = await runShapeChecks({ env: {} });

    const tableChecks = checks.filter((c) => c.id.startsWith('shape_table_'));
    expect(tableChecks.length).toBeGreaterThan(0);
    expect(tableChecks.every((c) => c.category === 'shape')).toBe(true);
    expect(tableChecks.every((c) => c.status === 'pass')).toBe(true);
    // each table triggers a `to_regclass` probe
    expect(sqlImpl.unsafe).toHaveBeenCalled();
    expect(sqlImpl.unsafe.mock.calls[0][0]).toContain("to_regclass('public.");
  });

  it('surfaces a migrate fix when a table is absent', async () => {
    mockGetSetupStatus.mockResolvedValue({ configured: true });
    const sqlImpl = Object.assign(vi.fn(), {
      unsafe: vi.fn().mockResolvedValue([{ oid: null }]),
    });
    mockGetSql.mockReturnValue(sqlImpl);

    const checks = await runShapeChecks({ env: {} });

    const tableChecks = checks.filter((c) => c.id.startsWith('shape_table_'));
    expect(tableChecks.every((c) => c.status === 'fail')).toBe(true);
    expect(tableChecks.every((c) => c.fix?.action === 'migrate')).toBe(true);
  });

  it('survives per-table query errors without aborting', async () => {
    mockGetSetupStatus.mockResolvedValue({ configured: true });
    const sqlImpl = Object.assign(vi.fn(), {
      unsafe: vi.fn().mockRejectedValue(new Error('boom')),
    });
    mockGetSql.mockReturnValue(sqlImpl);

    const checks = await runShapeChecks({ env: {} });
    // env checks still run even if every table query rejects
    expect(checks.some((c) => c.id.startsWith('shape_env_'))).toBe(true);
    expect(checks.some((c) => c.id.startsWith('shape_table_'))).toBe(false);
  });
});
