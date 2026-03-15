import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockSql, mockGetTask, mockDeleteTask } = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockGetTask: vi.fn(),
  mockDeleteTask: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/repositories/routing.repository.js', () => ({
  getTask: mockGetTask,
  deleteTask: mockDeleteTask,
}));

import { GET, DELETE } from '@/api/_archive/routing/tasks/[taskId]/route.js';

const params = Promise.resolve({ taskId: 'rt_1' });

describe('/api/routing/tasks/[taskId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://unit-test';
  });

  describe('GET', () => {
    it('returns task details', async () => {
      mockGetTask.mockResolvedValue({ id: 'rt_1', title: 'Task' });
      const res = await GET(
        makeRequest('http://localhost/api/routing/tasks/rt_1', { headers: { 'x-org-id': 'org_1' } }),
        { params }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.task.id).toBe('rt_1');
    });

    it('returns 404 when task not found', async () => {
      mockGetTask.mockResolvedValue(null);
      const res = await GET(
        makeRequest('http://localhost/api/routing/tasks/rt_1', { headers: { 'x-org-id': 'org_1' } }),
        { params }
      );
      expect(res.status).toBe(404);
    });

    it('returns 500 on error', async () => {
      mockGetTask.mockRejectedValue(new Error('db fail'));
      const res = await GET(
        makeRequest('http://localhost/api/routing/tasks/rt_1', { headers: { 'x-org-id': 'org_1' } }),
        { params }
      );
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE', () => {
    it('deletes task and returns success', async () => {
      mockDeleteTask.mockResolvedValue(true);
      const res = await DELETE(
        makeRequest('http://localhost/api/routing/tasks/rt_1', { headers: { 'x-org-id': 'org_1' } }),
        { params }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deleted).toBe(true);
    });

    it('returns 404 when task not found', async () => {
      mockDeleteTask.mockResolvedValue(false);
      const res = await DELETE(
        makeRequest('http://localhost/api/routing/tasks/rt_1', { headers: { 'x-org-id': 'org_1' } }),
        { params }
      );
      expect(res.status).toBe(404);
    });

    it('returns 500 on error', async () => {
      mockDeleteTask.mockRejectedValue(new Error('db fail'));
      const res = await DELETE(
        makeRequest('http://localhost/api/routing/tasks/rt_1', { headers: { 'x-org-id': 'org_1' } }),
        { params }
      );
      expect(res.status).toBe(500);
    });
  });
});
