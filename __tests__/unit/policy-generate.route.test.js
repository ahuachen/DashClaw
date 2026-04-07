import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGeneratePolicies, mockGetOrgId, mockGetSql, mockGetOrgRole } = vi.hoisted(() => ({
  mockGeneratePolicies: vi.fn(),
  mockGetOrgId: vi.fn(() => 'org_1'),
  mockGetSql: vi.fn(() => 'mock-sql'),
  mockGetOrgRole: vi.fn(() => 'admin'),
}));

vi.mock('@/lib/policy-generator.js', () => ({ generatePolicies: mockGeneratePolicies }));
vi.mock('@/lib/org', () => ({ getOrgId: mockGetOrgId, getOrgRole: mockGetOrgRole }));
vi.mock('@/lib/db.js', () => ({ getSql: mockGetSql }));

import { POST } from '@/api/policies/generate/route.js';
import { makeRequest } from '../helpers.js';

describe('POST /api/policies/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns generated policies on valid input', async () => {
    mockGeneratePolicies.mockResolvedValue({
      generated_policies: [
        { name: 'Block deploys', policy_type: 'block_action_type', rules: { action_types: ['deploy'] }, confidence: 0.9 },
      ],
      warnings: [],
      input_hash: 'abc123',
    });

    const req = makeRequest('http://localhost/api/policies/generate', {
      body: { input_text: 'Block all deploys', dry_run: true },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.generated_policies).toHaveLength(1);
    expect(data.input_hash).toBe('abc123');
  });

  it('returns 400 when input_text is missing', async () => {
    const req = makeRequest('http://localhost/api/policies/generate', {
      body: {},
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when input_text is empty', async () => {
    const req = makeRequest('http://localhost/api/policies/generate', {
      body: { input_text: '' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 422 when no LLM provider is configured', async () => {
    mockGeneratePolicies.mockResolvedValue({
      error: 'No LLM provider configured. Add an API key in Settings or /setup.',
    });

    const req = makeRequest('http://localhost/api/policies/generate', {
      body: { input_text: 'Block all deploys' },
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('caps input_text at 5000 characters', async () => {
    mockGeneratePolicies.mockResolvedValue({
      generated_policies: [],
      warnings: [],
      input_hash: 'x',
    });

    const req = makeRequest('http://localhost/api/policies/generate', {
      body: { input_text: 'a'.repeat(5001) },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
