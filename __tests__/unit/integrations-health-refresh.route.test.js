import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const {
  mockCheckAllIntegrations,
  mockUpsertHealth,
  mockGetHealthForOrg,
  mockGetSql,
  mockGetOrgId,
  mockGetOrgRole,
  mockFireHealthChangeAlerts,
} = vi.hoisted(() => ({
  mockCheckAllIntegrations: vi.fn(),
  // upsertHealth returns {changed, prev_status, new_status}; default: no change.
  mockUpsertHealth: vi.fn(async () => ({ changed: false, prev_status: null, new_status: 'healthy' })),
  mockGetHealthForOrg: vi.fn(),
  mockGetSql: vi.fn(() => ({})),
  mockGetOrgId: vi.fn(() => 'org_test'),
  mockGetOrgRole: vi.fn(() => 'admin'),
  mockFireHealthChangeAlerts: vi.fn(async () => ({ fired: 0 })),
}));

vi.mock('@/lib/db.js', () => ({ getSql: mockGetSql }));
vi.mock('@/lib/org.js', () => ({ getOrgId: mockGetOrgId, getOrgRole: mockGetOrgRole }));
vi.mock('@/lib/integration-health.js', () => ({ checkAllIntegrations: mockCheckAllIntegrations }));
vi.mock('@/lib/repositories/integration-health.repository.js', () => ({
  upsertHealth: mockUpsertHealth,
  getHealthForOrg: mockGetHealthForOrg,
}));
vi.mock('@/lib/health-change-alerts.js', () => ({
  fireHealthChangeAlerts: mockFireHealthChangeAlerts,
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
    mockUpsertHealth.mockResolvedValue({ changed: false, prev_status: null, new_status: 'healthy' });
    mockFireHealthChangeAlerts.mockResolvedValue({ fired: 0 });
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

  it('fires health-change alerts and reports the count when providers transition', async () => {
    // Slack went healthy→error, discord stayed put, github new observation.
    mockCheckAllIntegrations.mockResolvedValue({
      slack: { status: 'error', message: '401' },
      discord: { status: 'healthy', message: 'ok' },
      github: { status: 'healthy', message: 'ok' },
    });
    mockUpsertHealth.mockImplementation(async (_sql, _org, provider) => {
      if (provider === 'slack')   return { changed: true,  prev_status: 'healthy', new_status: 'error'   };
      if (provider === 'discord') return { changed: false, prev_status: 'healthy', new_status: 'healthy' };
      if (provider === 'github')  return { changed: false, prev_status: null,      new_status: 'healthy' }; // first observation
      return { changed: false, prev_status: null, new_status: 'healthy' };
    });
    mockFireHealthChangeAlerts.mockResolvedValue({ fired: 1 });
    mockGetHealthForOrg.mockResolvedValue([]);

    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checked).toBe(3);
    expect(body.alerts).toBe(1);

    // Only the slack transition is forwarded to fireHealthChangeAlerts —
    // discord's steady state and github's first-observation both suppress.
    expect(mockFireHealthChangeAlerts).toHaveBeenCalledTimes(1);
    const [, , transitions] = mockFireHealthChangeAlerts.mock.calls[0];
    expect(transitions).toEqual([
      { provider: 'slack', prev_status: 'healthy', new_status: 'error', message: '401' },
    ]);
  });

  it('skips fireHealthChangeAlerts entirely when nothing changed', async () => {
    mockCheckAllIntegrations.mockResolvedValue({
      slack: { status: 'healthy', message: 'ok' },
    });
    mockUpsertHealth.mockResolvedValue({ changed: false, prev_status: 'healthy', new_status: 'healthy' });
    mockGetHealthForOrg.mockResolvedValue([]);

    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(mockFireHealthChangeAlerts).not.toHaveBeenCalled();
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
