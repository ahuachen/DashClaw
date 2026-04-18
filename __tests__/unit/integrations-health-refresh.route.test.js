import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const {
  mockCheckAllIntegrations,
  mockUpsertHealth,
  mockGetHealthForOrg,
  mockGetSql,
  mockGetOrgId,
  mockGetOrgRole,
} = vi.hoisted(() => ({
  mockCheckAllIntegrations: vi.fn(),
  mockUpsertHealth: vi.fn(),
  mockGetHealthForOrg: vi.fn(),
  mockGetSql: vi.fn(() => ({})),
  mockGetOrgId: vi.fn(() => 'org_test'),
  mockGetOrgRole: vi.fn(() => 'admin'),
}));

vi.mock('@/lib/db.js', () => ({ getSql: mockGetSql }));
vi.mock('@/lib/org.js', () => ({ getOrgId: mockGetOrgId, getOrgRole: mockGetOrgRole }));
vi.mock('@/lib/integration-health.js', () => ({ checkAllIntegrations: mockCheckAllIntegrations }));
vi.mock('@/lib/repositories/integration-health.repository.js', () => ({
  upsertHealth: mockUpsertHealth,
  getHealthForOrg: mockGetHealthForOrg,
}));

import { POST } from '@/api/integrations/health/refresh/route.js';

function req() {
  return makeRequest('http://localhost/api/integrations/health/refresh', {
    headers: { 'x-org-id': 'org_test', 'x-org-role': 'admin' },
  });
}

describe('POST /api/integrations/health/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgRole.mockReturnValue('admin');
    mockGetOrgId.mockReturnValue('org_test');
  });

  it('returns 403 when the caller is not an admin', async () => {
    mockGetOrgRole.mockReturnValue('member');
    const res = await POST(req());
    expect(res.status).toBe(403);
    // Nothing touched downstream — early exit.
    expect(mockCheckAllIntegrations).not.toHaveBeenCalled();
    expect(mockUpsertHealth).not.toHaveBeenCalled();
  });

  it('runs checks, upserts configured providers, and returns the fresh health map', async () => {
    mockCheckAllIntegrations.mockResolvedValue({
      slack: { status: 'healthy', message: 'ok' },
      discord: { status: 'error', message: 'bad token' },
      github: { status: 'not_configured', message: 'missing key' },
    });
    mockGetHealthForOrg.mockResolvedValue([
      { provider: 'slack', status: 'healthy', message: 'ok', checked_at: '2026-04-17T23:00:00Z' },
      { provider: 'discord', status: 'error', message: 'bad token', checked_at: '2026-04-17T23:00:00Z' },
    ]);

    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();

    // checked = 2 (slack + discord); github was skipped because it's not_configured.
    expect(body.checked).toBe(2);
    expect(body.health).toEqual({
      slack:   { status: 'healthy', message: 'ok',        checked_at: '2026-04-17T23:00:00Z' },
      discord: { status: 'error',   message: 'bad token', checked_at: '2026-04-17T23:00:00Z' },
    });

    // upsert calls: one per configured provider, skipping not_configured.
    expect(mockUpsertHealth).toHaveBeenCalledTimes(2);
    const providers = mockUpsertHealth.mock.calls.map((c) => c[2]);
    expect(providers).toEqual(expect.arrayContaining(['slack', 'discord']));
    expect(providers).not.toContain('github');
  });

  it('returns 500 when the check pipeline throws', async () => {
    mockCheckAllIntegrations.mockRejectedValue(new Error('network down'));
    const res = await POST(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('still returns a health map even when no providers are configured', async () => {
    mockCheckAllIntegrations.mockResolvedValue({
      slack: { status: 'not_configured', message: 'no creds' },
    });
    mockGetHealthForOrg.mockResolvedValue([]);

    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checked).toBe(0);
    expect(body.health).toEqual({});
    expect(mockUpsertHealth).not.toHaveBeenCalled();
  });
});
