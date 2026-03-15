import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockSql, mockGetRoutingStats } = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockGetRoutingStats: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/repositories/routing.repository.js', () => ({ getRoutingStats: mockGetRoutingStats }));

import { GET } from '@/api/_archive/routing/stats/route.js';

describe('/api/routing/stats GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://unit-test';
  });

  it('returns routing stats', async () => {
    const stats = {
      agents: { total: 3, available: 2, busy: 1, offline: 0 },
      tasks: { total: 10, pending: 2, assigned: 3, completed: 5, failed: 0, escalated: 0 },
      routing: { total_decisions: 15 },
    };
    mockGetRoutingStats.mockResolvedValue(stats);
    const res = await GET(makeRequest('http://localhost/api/routing/stats', { headers: { 'x-org-id': 'org_1' } }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.agents.total).toBe(3);
    expect(data.tasks.total).toBe(10);
  });

  it('scopes to org_id', async () => {
    mockGetRoutingStats.mockResolvedValue({});
    await GET(makeRequest('http://localhost/api/routing/stats', { headers: { 'x-org-id': 'org_99' } }));
    expect(mockGetRoutingStats).toHaveBeenCalledWith(mockSql, 'org_99');
  });

  it('returns 500 on error', async () => {
    mockGetRoutingStats.mockRejectedValue(new Error('db fail'));
    const res = await GET(makeRequest('http://localhost/api/routing/stats', { headers: { 'x-org-id': 'org_1' } }));
    expect(res.status).toBe(500);
  });

  it('returns decision count', async () => {
    mockGetRoutingStats.mockResolvedValue({
      agents: {},
      tasks: {},
      routing: { total_decisions: 42 },
    });
    const res = await GET(makeRequest('http://localhost/api/routing/stats', { headers: { 'x-org-id': 'org_1' } }));
    const data = await res.json();
    expect(data.routing.total_decisions).toBe(42);
  });
});
