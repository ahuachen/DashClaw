import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockSql, mockGetAgent, mockUpdateAgentStatus, mockUnregisterAgent } = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockGetAgent: vi.fn(),
  mockUpdateAgentStatus: vi.fn(),
  mockUnregisterAgent: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/repositories/routing.repository.js', () => ({
  getAgent: mockGetAgent,
  updateAgentStatus: mockUpdateAgentStatus,
  unregisterAgent: mockUnregisterAgent,
}));

import { GET, PATCH, DELETE } from '@/api/_archive/routing/agents/[agentId]/route.js';

const params = Promise.resolve({ agentId: 'a1' });

describe('/api/routing/agents/[agentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://unit-test';
  });

  describe('GET', () => {
    it('returns agent details', async () => {
      mockGetAgent.mockResolvedValue({ id: 'a1', name: 'Bot' });
      const res = await GET(
        makeRequest('http://localhost/api/routing/agents/a1', { headers: { 'x-org-id': 'org_1' } }),
        { params }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.agent.id).toBe('a1');
    });

    it('returns 404 when agent not found', async () => {
      mockGetAgent.mockResolvedValue(null);
      const res = await GET(
        makeRequest('http://localhost/api/routing/agents/a1', { headers: { 'x-org-id': 'org_1' } }),
        { params }
      );
      expect(res.status).toBe(404);
    });

    it('returns 500 on error', async () => {
      mockGetAgent.mockRejectedValue(new Error('db fail'));
      const res = await GET(
        makeRequest('http://localhost/api/routing/agents/a1', { headers: { 'x-org-id': 'org_1' } }),
        { params }
      );
      expect(res.status).toBe(500);
    });
  });

  describe('PATCH', () => {
    it('updates agent status', async () => {
      mockUpdateAgentStatus.mockResolvedValue({ id: 'a1', status: 'busy' });
      const res = await PATCH(
        makeRequest('http://localhost/api/routing/agents/a1', { headers: { 'x-org-id': 'org_1' }, body: { status: 'busy' } }),
        { params }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.agent.status).toBe('busy');
    });

    it('returns 400 when status missing', async () => {
      const res = await PATCH(
        makeRequest('http://localhost/api/routing/agents/a1', { headers: { 'x-org-id': 'org_1' }, body: {} }),
        { params }
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid status', async () => {
      const res = await PATCH(
        makeRequest('http://localhost/api/routing/agents/a1', { headers: { 'x-org-id': 'org_1' }, body: { status: 'invalid' } }),
        { params }
      );
      expect(res.status).toBe(400);
    });

    it('returns 404 when agent not found', async () => {
      mockUpdateAgentStatus.mockResolvedValue(null);
      const res = await PATCH(
        makeRequest('http://localhost/api/routing/agents/a1', { headers: { 'x-org-id': 'org_1' }, body: { status: 'offline' } }),
        { params }
      );
      expect(res.status).toBe(404);
    });

    it('accepts all valid statuses', async () => {
      for (const status of ['available', 'busy', 'offline']) {
        mockUpdateAgentStatus.mockResolvedValue({ id: 'a1', status });
        const res = await PATCH(
          makeRequest('http://localhost/api/routing/agents/a1', { headers: { 'x-org-id': 'org_1' }, body: { status } }),
          { params }
        );
        expect(res.status).toBe(200);
      }
    });
  });

  describe('DELETE', () => {
    it('deletes agent and returns it', async () => {
      mockUnregisterAgent.mockResolvedValue({ id: 'a1', name: 'Bot' });
      const res = await DELETE(
        makeRequest('http://localhost/api/routing/agents/a1', { headers: { 'x-org-id': 'org_1' } }),
        { params }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deleted).toBe(true);
      expect(data.agent.id).toBe('a1');
    });

    it('returns 404 when agent not found', async () => {
      mockUnregisterAgent.mockResolvedValue(null);
      const res = await DELETE(
        makeRequest('http://localhost/api/routing/agents/a1', { headers: { 'x-org-id': 'org_1' } }),
        { params }
      );
      expect(res.status).toBe(404);
    });

    it('returns 500 on error', async () => {
      mockUnregisterAgent.mockRejectedValue(new Error('db fail'));
      const res = await DELETE(
        makeRequest('http://localhost/api/routing/agents/a1', { headers: { 'x-org-id': 'org_1' } }),
        { params }
      );
      expect(res.status).toBe(500);
    });
  });
});
