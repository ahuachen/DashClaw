import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockSql, mockGetOrgPlan } = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockGetOrgPlan: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/usage.js', () => ({
  getOrgPlan: mockGetOrgPlan,
}));

// Import AFTER mocks so requireTier's `getOrgPlan`/`getSql` come from the mocks.
import { requireTier } from '@/lib/org.js';
import { GET as fixtureGET } from '../fixtures/pro-gated-route-fixture.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockSql.mockImplementation(async () => []);
  mockSql.query.mockImplementation(async () => []);
});

describe('requireTier("pro")', () => {
  it('Case 1: pro org requesting pro-gated returns null (caller proceeds)', async () => {
    mockGetOrgPlan.mockResolvedValue('pro');
    const req = makeRequest('http://localhost/__test/pro', {
      headers: { 'x-org-id': 'org_pro' },
    });
    const result = await requireTier(req, 'pro');
    expect(result).toBeNull();
  });

  it('Case 2: free org requesting pro-gated returns 403 COMING_SOON with D-03 commitment signal', async () => {
    mockGetOrgPlan.mockResolvedValue('free');
    const req = makeRequest('http://localhost/__test/pro', {
      headers: { 'x-org-id': 'org_free' },
    });
    const result = await requireTier(req, 'pro');

    expect(result).not.toBeNull();
    expect(result.status).toBe(403);

    const body = await result.json();
    // Positive assertions — D-03 commitment signal must be non-negotiable.
    expect(body.code).toBe('COMING_SOON');
    expect(body.reason).toContain('50 verified');
    expect(body.reason).toContain('/pricing');
    expect(body.current_tier).toBe('free');
    expect(body.required_tier).toBe('pro');
    expect(body.error).toBe('Coming soon');
  });

  it('Case 3: unknown/null plan falls back to free-tier default-deny (T-03-03-01)', async () => {
    mockGetOrgPlan.mockResolvedValue(null);
    const req = makeRequest('http://localhost/__test/pro', {
      headers: { 'x-org-id': 'org_unknown' },
    });
    const result = await requireTier(req, 'pro');

    expect(result).not.toBeNull();
    expect(result.status).toBe(403);

    const body = await result.json();
    expect(body.code).toBe('COMING_SOON');
    // current_tier surfaces the raw value truthfully (null here)
    expect(body.current_tier).toBeNull();
    expect(body.required_tier).toBe('pro');
  });

  it('Case 3b: unknown string plan value also defaults to free-tier 403 (default-deny)', async () => {
    mockGetOrgPlan.mockResolvedValue('mystery-tier');
    const req = makeRequest('http://localhost/__test/pro', {
      headers: { 'x-org-id': 'org_mystery' },
    });
    const result = await requireTier(req, 'pro');

    expect(result).not.toBeNull();
    expect(result.status).toBe(403);

    const body = await result.json();
    expect(body.code).toBe('COMING_SOON');
    expect(body.current_tier).toBe('mystery-tier');
  });

  it('Case 4: 403 response body contains NO buy/upgrade/subscribe/pay language (D-07)', async () => {
    mockGetOrgPlan.mockResolvedValue('free');
    const req = makeRequest('http://localhost/__test/pro', {
      headers: { 'x-org-id': 'org_free' },
    });
    const result = await requireTier(req, 'pro');
    const body = await result.json();

    const fullText = JSON.stringify(body);
    expect(fullText).not.toMatch(/buy|upgrade|subscribe|pay/i);
  });
});

describe('pro-gated fixture route (non-regression consumer)', () => {
  it('pro org reaches the handler body', async () => {
    mockGetOrgPlan.mockResolvedValue('pro');
    const req = makeRequest('http://localhost/__test/pro', {
      headers: { 'x-org-id': 'org_pro' },
    });
    const res = await fixtureGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('free org is blocked at requireTier (403) and never reaches the handler body', async () => {
    mockGetOrgPlan.mockResolvedValue('free');
    const req = makeRequest('http://localhost/__test/pro', {
      headers: { 'x-org-id': 'org_free' },
    });
    const res = await fixtureGET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('COMING_SOON');
    expect(body.ok).toBeUndefined();
  });
});
