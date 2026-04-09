import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const mockGetAgentDetail = vi.fn();
const mockGetAgentTrustPosture = vi.fn();
const mockGetAssumptionsSummary = vi.fn();
const mockComputeSignals = vi.fn();
const mockGetOrgId = vi.fn(() => 'org_test');
const mockSqlInstance = vi.fn();

vi.mock('../../app/lib/db.js', () => ({ getSql: () => mockSqlInstance }));
vi.mock('../../app/lib/org.js', () => ({ getOrgId: (...a) => mockGetOrgId(...a) }));
vi.mock('../../app/lib/repositories/agents.repository.js', () => ({
  getAgentDetail: (...a) => mockGetAgentDetail(...a),
  getAgentTrustPosture: (...a) => mockGetAgentTrustPosture(...a),
}));
vi.mock('../../app/lib/repositories/assumptions.repository.js', () => ({
  getAssumptionsSummary: (...a) => mockGetAssumptionsSummary(...a),
}));
vi.mock('../../app/lib/signals.js', () => ({
  computeSignals: (...a) => mockComputeSignals(...a),
}));

const { GET } = await import('../../app/api/agents/[agentId]/profile/route.js');

function req() {
  return makeRequest('http://localhost:3000/api/agents/agent_1/profile', {
    headers: { 'x-api-key': 'oc_live_test' },
  });
}

const params = Promise.resolve({ agentId: 'agent_1' });

describe('GET /api/agents/[agentId]/profile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns aggregated profile data', async () => {
    mockGetAgentDetail.mockResolvedValueOnce({
      agent_id: 'agent_1', agent_name: 'Deploy Bot',
      action_count: 847, last_active: '2026-04-09T10:00:00Z',
      presence_state: 'online', last_heartbeat_at: '2026-04-09T16:00:00Z',
      current_task_id: null,
    });
    mockGetAgentTrustPosture.mockResolvedValueOnce({
      permission_level: 'workspace_write', identity_verified: true,
      signature_enforced: false, active_policies_count: 2, policies: [],
      approval_record: { total: 10, allowed: 8, denied: 2 }, blocks_30d: 1,
    });
    mockComputeSignals.mockResolvedValueOnce([]);
    mockGetAssumptionsSummary.mockResolvedValueOnce({ total: 5, validated: 3, invalidated: 1, unverified: 1 });

    const res = await GET(req(), { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.agent.agent_id).toBe('agent_1');
    expect(data.agent.agent_name).toBe('Deploy Bot');
    expect(data.agent.action_count).toBe(847);
    expect(data.agent.presence.status).toBe('online');
    expect(data.trust.permission_level).toBe('workspace_write');
    expect(data.signals).toEqual([]);
    expect(data.assumptions_summary.total).toBe(5);
  });

  it('returns 404 when agent not found', async () => {
    mockGetAgentDetail.mockResolvedValueOnce(null);

    const res = await GET(req(), { params: Promise.resolve({ agentId: 'agent_nope' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/not found/i);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetAgentDetail.mockRejectedValueOnce(new Error('DB down'));

    const res = await GET(req(), { params });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toMatch(/internal/i);
  });

  it('calls computeSignals with correct agent filter', async () => {
    mockGetAgentDetail.mockResolvedValueOnce({
      agent_id: 'agent_1', agent_name: 'Bot', action_count: 0,
      presence_state: 'offline',
    });
    mockGetAgentTrustPosture.mockResolvedValueOnce({
      permission_level: 'readonly', identity_verified: false,
      signature_enforced: false, active_policies_count: 0, policies: [],
      approval_record: { total: 0, allowed: 0, denied: 0 }, blocks_30d: 0,
    });
    mockComputeSignals.mockResolvedValueOnce([{ type: 'test', severity: 'red', label: 'X', detail: 'Y' }]);
    mockGetAssumptionsSummary.mockResolvedValueOnce({ total: 0, validated: 0, invalidated: 0, unverified: 0 });

    const res = await GET(req(), { params });
    const data = await res.json();

    expect(mockComputeSignals).toHaveBeenCalledWith('org_test', 'agent_1', expect.anything());
    expect(data.signals).toHaveLength(1);
  });
});
