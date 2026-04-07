import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const {
  mockSql,
  mockGetOrgId,
  mockGetCapability,
  mockGetCapabilityHealthSummary,
} = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockGetOrgId: vi.fn(),
  mockGetCapability: vi.fn(),
  mockGetCapabilityHealthSummary: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/org.js', () => ({ getOrgId: mockGetOrgId }));
vi.mock('@/lib/repositories/capabilities.repository.js', () => ({
  getCapability: mockGetCapability,
}));
vi.mock('@/lib/capability-health.js', () => ({
  getCapabilityHealthSummary: mockGetCapabilityHealthSummary,
}));
vi.mock('@/lib/apiErrors.js', () => ({
  apiErrorResponse: (error, label) => new Response(JSON.stringify({ error: error.message, label }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  }),
}));

import { GET } from '@/api/capabilities/[capabilityId]/health/route.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrgId.mockReturnValue('org_1');
});

describe('GET /api/capabilities/[capabilityId]/health', () => {
  it('returns derived health summary for the capability', async () => {
    mockGetCapability.mockResolvedValue({
      capability_id: 'cap_1',
      name: 'Research Agent',
      slug: 'research-agent',
      health_status: 'healthy',
    });
    mockGetCapabilityHealthSummary.mockResolvedValue({
      status: 'healthy',
      last_checked_at: '2026-04-07T00:00:00.000Z',
      last_success_at: '2026-04-07T00:00:00.000Z',
      last_failure_at: null,
      total_invocations: 8,
      successful_invocations: 8,
      failed_invocations: 0,
      pending_approvals: 0,
      success_rate_7d: 100,
      recent_errors: [],
    });

    const res = await GET(
      makeRequest('http://localhost/api/capabilities/cap_1/health'),
      { params: Promise.resolve({ capabilityId: 'cap_1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.capability_id).toBe('cap_1');
    expect(body.status).toBe('healthy');
    expect(body.total_invocations).toBe(8);
  });

  it('returns 404 when the capability does not exist', async () => {
    mockGetCapability.mockResolvedValue(null);

    const res = await GET(
      makeRequest('http://localhost/api/capabilities/cap_missing/health'),
      { params: Promise.resolve({ capabilityId: 'cap_missing' }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});
