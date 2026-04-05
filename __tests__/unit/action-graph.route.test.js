import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSql, mockBuildActionGraph, mockGetOrgId } = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockBuildActionGraph: vi.fn(),
  mockGetOrgId: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/org.js', () => ({ getOrgId: mockGetOrgId }));
vi.mock('@/lib/apiErrors.js', () => ({
  apiErrorResponse: (error, label) => {
    // Mirror the real helper's shape so we can assert on status.
    return new Response(JSON.stringify({ error: error.message || 'internal error', label }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  },
}));
vi.mock('@/lib/repositories/actions.repository.js', () => ({
  buildActionGraph: mockBuildActionGraph,
}));

import { GET } from '@/api/actions/[actionId]/graph/route.js';

function makeRequest(url) {
  return {
    url,
    headers: new Headers(),
    nextUrl: new URL(url),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrgId.mockReturnValue('org_1');
});

describe('GET /api/actions/[actionId]/graph', () => {
  it('returns 404 when the action is not found', async () => {
    mockBuildActionGraph.mockResolvedValue(null);
    const req = makeRequest('http://test/api/actions/act_missing/graph');
    const res = await GET(req, { params: Promise.resolve({ actionId: 'act_missing' }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
    expect(mockBuildActionGraph).toHaveBeenCalledWith(mockSql, 'org_1', 'act_missing');
  });

  it('returns the graph payload on success', async () => {
    const payload = {
      rootActionId: 'act_1',
      nodes: [
        { id: 'action:act_1', type: 'action', status: 'completed', isRoot: true, riskScore: 20 },
        { id: 'assumption:as_1', type: 'assumption', status: 'invalidated' },
      ],
      edges: [
        { id: 'edge:as:as_1->act_1', source: 'assumption:as_1', target: 'action:act_1', type: 'assumption_of' },
      ],
    };
    mockBuildActionGraph.mockResolvedValue(payload);

    const req = makeRequest('http://test/api/actions/act_1/graph');
    const res = await GET(req, { params: Promise.resolve({ actionId: 'act_1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rootActionId).toBe('act_1');
    expect(body.nodes).toHaveLength(2);
    expect(body.edges).toHaveLength(1);
  });

  it('returns 500 via apiErrorResponse when the repository throws', async () => {
    mockBuildActionGraph.mockRejectedValue(new Error('boom'));
    const req = makeRequest('http://test/api/actions/act_1/graph');
    const res = await GET(req, { params: Promise.resolve({ actionId: 'act_1' }) });
    expect(res.status).toBe(500);
  });
});
