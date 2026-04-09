import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest, createSqlMock } from '../helpers.js';

const mockGetOrgId = vi.fn(() => 'org_test');
let mockSqlInstance;

vi.mock('../../app/lib/db.js', () => ({ getSql: () => mockSqlInstance }));
vi.mock('../../app/lib/org.js', () => ({ getOrgId: (...a) => mockGetOrgId(...a) }));

const { GET } = await import('../../app/api/guard/decisions/route.js');

function getReq(params = '') {
  return makeRequest(`http://localhost:3000/api/guard/decisions${params}`, {
    headers: { 'x-api-key': 'oc_live_test' },
  });
}

describe('GET /api/guard/decisions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns decisions with stats', async () => {
    mockSqlInstance = createSqlMock({
      queryResponses: [
        [{ id: 'gd_1', decision: 'block', risk_score: 90, agent_id: 'a1', action_type: 'deploy', reason: 'Risk >= 90', matched_policies: '["Critical Risk Block"]', context: '{"declared_goal":"Push to prod","agent_name":"Bot"}', created_at: '2026-04-09T10:00:00Z' }],
        [{ total: '1' }],
        [{ blocks: '5', approvals: '3', warns: '2' }],
      ],
    });

    const res = await GET(getReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.decisions).toHaveLength(1);
    expect(data.decisions[0].decision).toBe('block');
    expect(data.decisions[0].declared_goal).toBe('Push to prod');
    expect(data.decisions[0].agent_name).toBe('Bot');
    expect(data.decisions[0].matched_policies).toEqual(['Critical Risk Block']);
    expect(data.decisions[0].context).toBeUndefined();
    expect(data.total).toBe(1);
    expect(data.stats).toEqual({ blocks: 5, approvals: 3, warns: 2 });
  });

  it('filters by decision type', async () => {
    mockSqlInstance = createSqlMock({
      queryResponses: [[], [{ total: '0' }], [{ blocks: '0', approvals: '0', warns: '0' }]],
    });

    await GET(getReq('?decision=block'));

    expect(mockSqlInstance.queryCalls[0].text).toContain('gd.decision =');
    expect(mockSqlInstance.queryCalls[0].params).toContain('block');
  });

  it('filters by agent_id', async () => {
    mockSqlInstance = createSqlMock({
      queryResponses: [[], [{ total: '0' }], [{ blocks: '0', approvals: '0', warns: '0' }]],
    });

    await GET(getReq('?agent_id=agent_42'));

    expect(mockSqlInstance.queryCalls[0].text).toContain('gd.agent_id =');
    expect(mockSqlInstance.queryCalls[0].params).toContain('agent_42');
  });

  it('returns empty with zero stats on no data', async () => {
    mockSqlInstance = createSqlMock({
      queryResponses: [[], [{ total: '0' }], [{}]],
    });

    const res = await GET(getReq());
    const data = await res.json();

    expect(data.decisions).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.stats).toEqual({ blocks: 0, approvals: 0, warns: 0 });
  });

  it('returns 500 on error', async () => {
    mockSqlInstance = createSqlMock({});
    mockSqlInstance.query = async () => { throw new Error('DB down'); };

    const res = await GET(getReq());
    expect(res.status).toBe(500);
  });
});
