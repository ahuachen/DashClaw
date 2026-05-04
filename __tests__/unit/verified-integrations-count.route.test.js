import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSql, mockCountVerifiedIntegrations } = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockCountVerifiedIntegrations: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/repositories/monetization.repository.js', () => ({
  countVerifiedIntegrations: mockCountVerifiedIntegrations,
}));

import { GET } from '@/api/monetization/verified-integrations-count/route.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/monetization/verified-integrations-count', () => {
  it('Case 1: success returns 200 with { count, target: 50 }', async () => {
    mockCountVerifiedIntegrations.mockResolvedValue(7);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(7);
    expect(body.target).toBe(50);
  });

  it('Case 2: repository throws → 200 { count: null, target: 50, error: unavailable } (fail-graceful)', async () => {
    mockCountVerifiedIntegrations.mockRejectedValue(new Error('db down'));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBeNull();
    expect(body.target).toBe(50);
    expect(body.error).toBe('unavailable');
  });

  it('Case 3: response contains NO per-org data (T-03-03-02 information-disclosure mitigation)', async () => {
    mockCountVerifiedIntegrations.mockResolvedValue(12);
    const res = await GET();
    const body = await res.json();
    const keys = Object.keys(body);

    expect(keys).not.toContain('org_id');
    expect(keys).not.toContain('agent_id');
    expect(keys).not.toContain('orgs');
    expect(keys).not.toContain('agents');
    expect(keys).not.toContain('integrations');
    // Sanity: only the documented aggregate fields plus optional error
    for (const k of keys) {
      expect(['count', 'target', 'error']).toContain(k);
    }
  });

  it('Case 4: count is zero when repository returns 0', async () => {
    mockCountVerifiedIntegrations.mockResolvedValue(0);
    const res = await GET();
    const body = await res.json();
    expect(body.count).toBe(0);
    expect(body.target).toBe(50);
  });

  it('Case 5: error response also contains NO per-org data', async () => {
    mockCountVerifiedIntegrations.mockRejectedValue(new Error('boom'));
    const res = await GET();
    const body = await res.json();
    const keys = Object.keys(body);
    expect(keys).not.toContain('org_id');
    expect(keys).not.toContain('agent_id');
  });
});
