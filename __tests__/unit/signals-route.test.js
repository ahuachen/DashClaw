import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

// --- Mocks ---

const mockSqlInstance = vi.fn();
const mockGetOrgId = vi.fn(() => 'org_test');
const mockComputeSignals = vi.fn();

vi.mock('../../app/lib/db.js', () => ({ getSql: () => mockSqlInstance }));
vi.mock('../../app/lib/org.js', () => ({ getOrgId: (...a) => mockGetOrgId(...a) }));
vi.mock('../../app/lib/signals.js', () => ({
  computeSignals: (...a) => mockComputeSignals(...a),
}));

const { GET } = await import('../../app/api/signals/route.js');

// --- Helpers ---

function getReq(params = '') {
  return makeRequest(`http://localhost:3000/api/signals${params}`, {
    headers: { 'x-api-key': 'oc_live_test' },
  });
}

describe('GET /api/signals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns signals with severity counts', async () => {
    mockComputeSignals.mockResolvedValueOnce([
      { type: 'autonomy_spike', severity: 'red', label: 'Spike', agent_id: 'a1' },
      { type: 'stale_assumption', severity: 'amber', label: 'Stale', agent_id: 'a2' },
      { type: 'repeated_failures', severity: 'red', label: 'Failures', agent_id: 'a1' },
    ]);

    const res = await GET(getReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.signals).toHaveLength(3);
    expect(data.counts.red).toBe(2);
    expect(data.counts.amber).toBe(1);
    expect(data.counts.total).toBe(3);
    expect(data.lastUpdated).toBeDefined();
  });

  it('returns empty signals when none detected', async () => {
    mockComputeSignals.mockResolvedValueOnce([]);

    const res = await GET(getReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.signals).toHaveLength(0);
    expect(data.counts).toEqual({ red: 0, amber: 0, total: 0 });
  });

  it('passes agent_id filter to computeSignals', async () => {
    mockComputeSignals.mockResolvedValueOnce([]);

    await GET(getReq('?agent_id=agent_42'));

    expect(mockComputeSignals).toHaveBeenCalledWith('org_test', 'agent_42', expect.anything());
  });

  it('passes null when no agent_id filter', async () => {
    mockComputeSignals.mockResolvedValueOnce([]);

    await GET(getReq());

    expect(mockComputeSignals).toHaveBeenCalledWith('org_test', null, expect.anything());
  });

  it('returns 500 with safe defaults on error', async () => {
    mockComputeSignals.mockRejectedValueOnce(new Error('DB down'));

    const res = await GET(getReq());
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.signals).toEqual([]);
    expect(data.counts).toEqual({ red: 0, amber: 0, total: 0 });
  });
});
