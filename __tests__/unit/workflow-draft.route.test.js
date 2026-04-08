import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockGetSql, mockGetOrgId } = vi.hoisted(() => ({
  mockGetSql: vi.fn(() => 'mock-sql'),
  mockGetOrgId: vi.fn(() => 'org_1'),
}));

vi.mock('@/lib/db.js', () => ({ getSql: mockGetSql }));
vi.mock('@/lib/org.js', () => ({ getOrgId: mockGetOrgId }));
vi.mock('@/lib/repositories/model-strategies.repository.js', () => ({ listModelStrategies: vi.fn() }));
vi.mock('@/lib/repositories/guardrails.repository.js', () => ({ getActivePolicies: vi.fn() }));
vi.mock('@/lib/repositories/knowledge.repository.js', () => ({ listCollections: vi.fn() }));
vi.mock('@/lib/repositories/capabilities.repository.js', () => ({ listCapabilities: vi.fn() }));
vi.mock('@/lib/prompt.js', () => ({ listTemplates: vi.fn() }));

import { POST } from '@/api/workflows/draft/route.js';

describe('POST /api/workflows/draft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an unsupported provider', async () => {
    const req = makeRequest('http://localhost/api/workflows/draft', {
      headers: { 'x-org-id': 'org_1' },
      body: {
        description: 'Build a refund workflow',
        api_key: 'sk-test',
        provider: 'unknown',
      },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/provider is not supported/i);
  });

  it('rejects a model that does not belong to the selected provider', async () => {
    const req = makeRequest('http://localhost/api/workflows/draft', {
      headers: { 'x-org-id': 'org_1' },
      body: {
        description: 'Build a refund workflow',
        api_key: 'sk-test',
        provider: 'anthropic',
        model: 'gpt-5.4',
      },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/model is not supported/i);
  });
});
