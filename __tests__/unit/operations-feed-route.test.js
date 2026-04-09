import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

// --- Mocks ---

const mockSqlInstance = vi.fn();
const mockGetOrgId = vi.fn(() => 'org_test');
const mockBuildOperationsFeed = vi.fn();

vi.mock('../../app/lib/db.js', () => ({ getSql: () => mockSqlInstance }));
vi.mock('../../app/lib/org.js', () => ({ getOrgId: (...a) => mockGetOrgId(...a) }));
vi.mock('../../app/lib/operations-feed.js', () => ({
  buildOperationsFeed: (...a) => mockBuildOperationsFeed(...a),
}));

const { GET } = await import('../../app/api/operations/feed/route.js');

// --- Helpers ---

function getReq(params = '') {
  return makeRequest(`http://localhost:3000/api/operations/feed${params}`, {
    headers: { 'x-api-key': 'oc_live_test' },
  });
}

describe('GET /api/operations/feed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns feed with default filters', async () => {
    const feedResult = {
      items: [{ id: 1, type: 'action', label: 'Deploy' }],
      total: 1,
    };
    mockBuildOperationsFeed.mockResolvedValueOnce(feedResult);

    const res = await GET(getReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.total).toBe(1);
  });

  it('passes filter params through', async () => {
    mockBuildOperationsFeed.mockResolvedValueOnce({ items: [], total: 0 });

    await GET(getReq('?category=workflow&severity=red&limit=10&offset=5'));

    expect(mockBuildOperationsFeed).toHaveBeenCalledWith(
      expect.anything(), 'org_test',
      expect.objectContaining({
        category: 'workflow',
        severity: 'red',
        limit: '10',
        offset: '5',
      })
    );
  });

  it('passes undefined for absent filter params', async () => {
    mockBuildOperationsFeed.mockResolvedValueOnce({ items: [], total: 0 });

    await GET(getReq());

    expect(mockBuildOperationsFeed).toHaveBeenCalledWith(
      expect.anything(), 'org_test',
      expect.objectContaining({
        category: undefined,
        severity: undefined,
        limit: 50,
        offset: 0,
      })
    );
  });

  it('returns 500 on error', async () => {
    mockBuildOperationsFeed.mockRejectedValueOnce(new Error('boom'));

    const res = await GET(getReq());
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});
