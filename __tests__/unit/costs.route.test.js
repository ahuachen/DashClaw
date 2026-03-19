import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockSql, mockGetCostAggregation } = vi.hoisted(() => ({
  mockSql: vi.fn(async () => []),
  mockGetCostAggregation: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/org.js', () => ({ getOrgId: () => 'org_test' }));
vi.mock('@/lib/repositories/actions.repository.js', () => ({
  getCostAggregation: mockGetCostAggregation,
}));

import { GET } from '@/api/actions/costs/route.js';
import * as actionsRepo from '@/lib/repositories/actions.repository.js';

const defaultCostData = {
  total_cost_usd: 1.25,
  total_tokens_in: 10000,
  total_tokens_out: 5000,
  period: '30d',
  by_agent: [{ agent_id: 'agent_1', cost_usd: 1.25, action_count: 10 }],
  by_day: [{ date: '2026-03-19', cost_usd: 0.5, action_count: 4 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCostAggregation.mockResolvedValue(defaultCostData);
});

describe('getCostAggregation export', () => {
  it('is exported from the actions repository', () => {
    expect(typeof actionsRepo.getCostAggregation).toBe('function');
  });
});

describe('GET /api/actions/costs', () => {
  it('returns 400 for an invalid period', async () => {
    const req = makeRequest('http://localhost/api/actions/costs?period=999d', {
      headers: { 'x-org-id': 'org_test' },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid period/);
  });

  it('returns 400 for an unrecognised period string', async () => {
    const req = makeRequest('http://localhost/api/actions/costs?period=1y', {
      headers: { 'x-org-id': 'org_test' },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 with the aggregation shape when period is valid', async () => {
    const req = makeRequest('http://localhost/api/actions/costs?period=30d', {
      headers: { 'x-org-id': 'org_test' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('total_cost_usd');
    expect(body).toHaveProperty('total_tokens_in');
    expect(body).toHaveProperty('total_tokens_out');
    expect(body).toHaveProperty('period');
    expect(body).toHaveProperty('by_agent');
    expect(body).toHaveProperty('by_day');
  });

  it('defaults to 30d period when period param is absent', async () => {
    const req = makeRequest('http://localhost/api/actions/costs', {
      headers: { 'x-org-id': 'org_test' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGetCostAggregation).toHaveBeenCalledWith(
      mockSql,
      'org_test',
      { period: '30d', agentId: null }
    );
  });

  it('passes agent_id filter when provided', async () => {
    const req = makeRequest('http://localhost/api/actions/costs?period=7d&agent_id=agent_xyz', {
      headers: { 'x-org-id': 'org_test' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGetCostAggregation).toHaveBeenCalledWith(
      mockSql,
      'org_test',
      { period: '7d', agentId: 'agent_xyz' }
    );
  });

  it('returns 500 when getCostAggregation throws', async () => {
    mockGetCostAggregation.mockRejectedValue(new Error('DB failure'));
    const req = makeRequest('http://localhost/api/actions/costs?period=30d', {
      headers: { 'x-org-id': 'org_test' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch cost data');
  });

  it('accepts all three valid period values', async () => {
    for (const period of ['7d', '30d', '90d']) {
      const req = makeRequest(`http://localhost/api/actions/costs?period=${period}`, {
        headers: { 'x-org-id': 'org_test' },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
    }
  });
});
