import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const {
  mockSql,
  mockGetOrgId,
  mockListCapabilityHealthSummaries,
} = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockGetOrgId: vi.fn(),
  mockListCapabilityHealthSummaries: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/org.js', () => ({ getOrgId: mockGetOrgId }));
vi.mock('@/lib/capability-health.js', () => ({
  listCapabilityHealthSummaries: mockListCapabilityHealthSummaries,
}));
vi.mock('@/lib/apiErrors.js', () => ({
  apiErrorResponse: (error, label) => new Response(JSON.stringify({ error: error.message, label }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  }),
}));

import { GET } from '@/api/capabilities/health/route.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrgId.mockReturnValue('org_1');
});

describe('GET /api/capabilities/health', () => {
  it('returns derived health rows for matching capabilities', async () => {
    mockListCapabilityHealthSummaries.mockResolvedValue([
      {
        capability_id: 'cap_1',
        name: 'Slack Notify',
        slug: 'slack-notify',
        risk_level: 'medium',
        category: 'messaging',
        status: 'healthy',
        success_rate_7d: 100,
        total_invocations: 4,
        failed_invocations: 0,
      },
      {
        capability_id: 'cap_2',
        name: 'CRM Sync',
        slug: 'crm-sync',
        risk_level: 'medium',
        category: 'sales',
        status: 'degraded',
        success_rate_7d: 50,
        total_invocations: 6,
        failed_invocations: 3,
      },
    ]);

    const res = await GET(
      makeRequest('http://localhost/api/capabilities/health?risk_level=medium&limit=2'),
    );

    expect(res.status).toBe(200);
    expect(mockListCapabilityHealthSummaries).toHaveBeenCalledWith(mockSql, 'org_1', {
      category: undefined,
      risk_level: 'medium',
      search: undefined,
      limit: '2',
      offset: 0,
    });

    const body = await res.json();
    expect(body.capabilities).toHaveLength(2);
    expect(body.capabilities[0]).toMatchObject({
      capability_id: 'cap_1',
      name: 'Slack Notify',
      slug: 'slack-notify',
      status: 'healthy',
      success_rate_7d: 100,
    });
    expect(body.capabilities[1]).toMatchObject({
      capability_id: 'cap_2',
      name: 'CRM Sync',
      slug: 'crm-sync',
      status: 'degraded',
      failed_invocations: 3,
    });
  });

  it('returns an empty collection when no capabilities match', async () => {
    mockListCapabilityHealthSummaries.mockResolvedValue([]);

    const res = await GET(makeRequest('http://localhost/api/capabilities/health'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.capabilities).toEqual([]);
  });
});
