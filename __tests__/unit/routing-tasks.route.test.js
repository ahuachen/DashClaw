import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockSql, mockSubmitTask, mockListTasks, mockPublishOrgEvent } = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockSubmitTask: vi.fn(),
  mockListTasks: vi.fn(),
  mockPublishOrgEvent: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/repositories/routing.repository.js', () => ({
  submitTask: mockSubmitTask,
  listTasks: mockListTasks,
}));
vi.mock('@/lib/events.js', () => ({
  EVENTS: { TASK_ASSIGNED: 'task.assigned' },
  publishOrgEvent: mockPublishOrgEvent,
}));

import { GET, POST } from '@/api/_archive/routing/tasks/route.js';

describe('/api/routing/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://unit-test';
  });

  describe('GET', () => {
    it('returns tasks list', async () => {
      mockListTasks.mockResolvedValue([{ id: 'rt_1', title: 'Task 1' }]);
      const res = await GET(makeRequest('http://localhost/api/routing/tasks', { headers: { 'x-org-id': 'org_1' } }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.tasks).toHaveLength(1);
      expect(data.total).toBe(1);
    });

    it('passes filters from query params', async () => {
      mockListTasks.mockResolvedValue([]);
      await GET(makeRequest('http://localhost/api/routing/tasks?status=pending&assigned_to=a1&limit=10', { headers: { 'x-org-id': 'org_1' } }));
      expect(mockListTasks).toHaveBeenCalledWith(mockSql, 'org_1', expect.objectContaining({
        status: 'pending',
        assignedTo: 'a1',
        limit: 10,
      }));
    });

    it('caps limit at 200', async () => {
      mockListTasks.mockResolvedValue([]);
      await GET(makeRequest('http://localhost/api/routing/tasks?limit=500', { headers: { 'x-org-id': 'org_1' } }));
      expect(mockListTasks).toHaveBeenCalledWith(mockSql, 'org_1', expect.objectContaining({ limit: 200 }));
    });

    it('returns 500 on error', async () => {
      mockListTasks.mockRejectedValue(new Error('db fail'));
      const res = await GET(makeRequest('http://localhost/api/routing/tasks', { headers: { 'x-org-id': 'org_1' } }));
      expect(res.status).toBe(500);
    });
  });

  describe('POST', () => {
    it('returns 400 when title missing', async () => {
      const res = await POST(makeRequest('http://localhost/api/routing/tasks', {
        headers: { 'x-org-id': 'org_1' },
        body: {},
      }));
      expect(res.status).toBe(400);
    });

    it('submits task and returns 201', async () => {
      const result = { task: { id: 'rt_1', title: 'Deploy' }, routing: { status: 'assigned' } };
      mockSubmitTask.mockResolvedValue(result);
      const res = await POST(makeRequest('http://localhost/api/routing/tasks', {
        headers: { 'x-org-id': 'org_1' },
        body: { title: 'Deploy' },
      }));
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.task.id).toBe('rt_1');
    });

    it('publishes TASK_ASSIGNED event', async () => {
      mockSubmitTask.mockResolvedValue({ task: { id: 'rt_1' }, routing: {} });
      await POST(makeRequest('http://localhost/api/routing/tasks', {
        headers: { 'x-org-id': 'org_1' },
        body: { title: 'Deploy' },
      }));
      expect(mockPublishOrgEvent).toHaveBeenCalledWith('task.assigned', expect.objectContaining({ orgId: 'org_1' }));
    });

    it('returns 500 on error', async () => {
      mockSubmitTask.mockRejectedValue(new Error('routing fail'));
      const res = await POST(makeRequest('http://localhost/api/routing/tasks', {
        headers: { 'x-org-id': 'org_1' },
        body: { title: 'Deploy' },
      }));
      expect(res.status).toBe(500);
    });
  });
});
