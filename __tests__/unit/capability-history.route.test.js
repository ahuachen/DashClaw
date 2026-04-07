import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const {
  mockSql,
  mockGetOrgId,
  mockGetCapability,
  mockGetCapabilityHistory,
} = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockGetOrgId: vi.fn(),
  mockGetCapability: vi.fn(),
  mockGetCapabilityHistory: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/org.js', () => ({ getOrgId: mockGetOrgId }));
vi.mock('@/lib/repositories/capabilities.repository.js', () => ({
  getCapability: mockGetCapability,
}));
vi.mock('@/lib/capability-history.js', () => ({
  getCapabilityHistory: mockGetCapabilityHistory,
}));
vi.mock('@/lib/apiErrors.js', () => ({
  apiErrorResponse: (error, label) => new Response(JSON.stringify({ error: error.message, label }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  }),
}));

import { GET } from '@/api/capabilities/[capabilityId]/history/route.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrgId.mockReturnValue('org_1');
});

describe('GET /api/capabilities/[capabilityId]/history', () => {
  it('returns recent test and invoke events for the capability', async () => {
    mockGetCapability.mockResolvedValue({
      capability_id: 'cap_1',
      name: 'Research Agent',
      slug: 'research-agent',
    });
    mockGetCapabilityHistory.mockResolvedValue({
      capability_id: 'cap_1',
      name: 'Research Agent',
      slug: 'research-agent',
      events: [
        {
          action_id: 'act_test_1',
          action_type: 'capability_test',
          status: 'completed',
          timestamp_start: '2026-04-07T10:00:00.000Z',
          duration_ms: 42,
        },
        {
          action_id: 'act_inv_1',
          action_type: 'capability_invoke',
          status: 'failed',
          timestamp_start: '2026-04-07T09:00:00.000Z',
          error_message: 'downstream timeout',
        },
      ],
    });

    const res = await GET(
      makeRequest('http://localhost/api/capabilities/cap_1/history?action_type=capability_test&status=completed&limit=5'),
      { params: Promise.resolve({ capabilityId: 'cap_1' }) },
    );

    expect(res.status).toBe(200);
    expect(mockGetCapabilityHistory).toHaveBeenCalledWith(mockSql, 'org_1', {
      capability_id: 'cap_1',
      name: 'Research Agent',
      slug: 'research-agent',
    }, {
      action_type: 'capability_test',
      status: 'completed',
      limit: '5',
      offset: 0,
    });

    const body = await res.json();
    expect(body.capability_id).toBe('cap_1');
    expect(body.events).toHaveLength(2);
    expect(body.events[0].action_id).toBe('act_test_1');
  });

  it('returns 404 when the capability does not exist', async () => {
    mockGetCapability.mockResolvedValue(null);

    const res = await GET(
      makeRequest('http://localhost/api/capabilities/cap_missing/history'),
      { params: Promise.resolve({ capabilityId: 'cap_missing' }) },
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});
