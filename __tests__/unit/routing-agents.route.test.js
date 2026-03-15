import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockSql, mockRegisterAgent, mockListAgents } = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockRegisterAgent: vi.fn(),
  mockListAgents: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/repositories/routing.repository.js', () => ({
  registerAgent: mockRegisterAgent,
  listAgents: mockListAgents,
}));

import { GET, POST } from '@/api/_archive/routing/agents/route.js';

describe('/api/routing/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://unit-test';
  });

  describe('GET', () => {
    it('returns agents list', async () => {
      mockListAgents.mockResolvedValue([{ id: 'a1', name: 'Bot' }]);
      const res = await GET(makeRequest('http://localhost/api/routing/agents', { headers: { 'x-org-id': 'org_1' } }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.agents).toHaveLength(1);
    });

    it('filters by status', async () => {
      mockListAgents.mockResolvedValue([]);
      await GET(makeRequest('http://localhost/api/routing/agents?status=available', { headers: { 'x-org-id': 'org_1' } }));
      expect(mockListAgents).toHaveBeenCalledWith(mockSql, 'org_1', 'available');
    });

    it('returns 500 on error', async () => {
      mockListAgents.mockRejectedValue(new Error('db fail'));
      const res = await GET(makeRequest('http://localhost/api/routing/agents', { headers: { 'x-org-id': 'org_1' } }));
      expect(res.status).toBe(500);
    });
  });

  describe('POST', () => {
    it('returns 400 when name missing', async () => {
      const res = await POST(makeRequest('http://localhost/api/routing/agents', {
        headers: { 'x-org-id': 'org_1' },
        body: {},
      }));
      expect(res.status).toBe(400);
    });

    it('registers agent and returns 201', async () => {
      mockRegisterAgent.mockResolvedValue({ id: 'a1', name: 'Bot', status: 'available' });
      const res = await POST(makeRequest('http://localhost/api/routing/agents', {
        headers: { 'x-org-id': 'org_1' },
        body: { name: 'Bot', capabilities: ['code'] },
      }));
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.agent.name).toBe('Bot');
    });

    it('rejects non-HTTPS endpoint', async () => {
      const res = await POST(makeRequest('http://localhost/api/routing/agents', {
        headers: { 'x-org-id': 'org_1' },
        body: { name: 'Bot', endpoint: 'http://evil.com/hook' },
      }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('HTTPS');
    });

    it('rejects endpoint with credentials', async () => {
      const res = await POST(makeRequest('http://localhost/api/routing/agents', {
        headers: { 'x-org-id': 'org_1' },
        body: { name: 'Bot', endpoint: 'https://user:pass@example.com/hook' },
      }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('credentials');
    });

    it('rejects invalid endpoint URL', async () => {
      const res = await POST(makeRequest('http://localhost/api/routing/agents', {
        headers: { 'x-org-id': 'org_1' },
        body: { name: 'Bot', endpoint: 'not-a-url' },
      }));
      expect(res.status).toBe(400);
    });

    it('validates maxConcurrent range', async () => {
      const res = await POST(makeRequest('http://localhost/api/routing/agents', {
        headers: { 'x-org-id': 'org_1' },
        body: { name: 'Bot', maxConcurrent: 200 },
      }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('maxConcurrent');
    });

    it('validates capabilities is array', async () => {
      const res = await POST(makeRequest('http://localhost/api/routing/agents', {
        headers: { 'x-org-id': 'org_1' },
        body: { name: 'Bot', capabilities: 'not-array' },
      }));
      expect(res.status).toBe(400);
    });

    it('rejects capabilities with >50 items', async () => {
      const res = await POST(makeRequest('http://localhost/api/routing/agents', {
        headers: { 'x-org-id': 'org_1' },
        body: { name: 'Bot', capabilities: Array(51).fill('skill') },
      }));
      expect(res.status).toBe(400);
    });

    it('accepts valid HTTPS endpoint', async () => {
      mockRegisterAgent.mockResolvedValue({ id: 'a1', name: 'Bot' });
      const res = await POST(makeRequest('http://localhost/api/routing/agents', {
        headers: { 'x-org-id': 'org_1' },
        body: { name: 'Bot', endpoint: 'https://example.com/hook' },
      }));
      expect(res.status).toBe(201);
    });

    it('returns 500 on internal error', async () => {
      mockRegisterAgent.mockRejectedValue(new Error('db fail'));
      const res = await POST(makeRequest('http://localhost/api/routing/agents', {
        headers: { 'x-org-id': 'org_1' },
        body: { name: 'Bot' },
      }));
      expect(res.status).toBe(500);
    });
  });
});
