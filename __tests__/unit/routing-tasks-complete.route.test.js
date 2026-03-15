import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockSql, mockCompleteTask, mockPublishOrgEvent } = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockCompleteTask: vi.fn(),
  mockPublishOrgEvent: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/repositories/routing.repository.js', () => ({ completeTask: mockCompleteTask }));
vi.mock('@/lib/events.js', () => ({
  EVENTS: { TASK_COMPLETED: 'task.completed' },
  publishOrgEvent: mockPublishOrgEvent,
}));

import { POST } from '@/api/_archive/routing/tasks/[taskId]/complete/route.js';

const params = Promise.resolve({ taskId: 'rt_1' });

describe('/api/routing/tasks/[taskId]/complete POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://unit-test';
  });

  it('completes task with success', async () => {
    const result = { task: { id: 'rt_1', status: 'completed' }, routing: { status: 'completed' } };
    mockCompleteTask.mockResolvedValue(result);
    const res = await POST(
      makeRequest('http://localhost/api/routing/tasks/rt_1/complete', { headers: { 'x-org-id': 'org_1' }, body: { success: true, result: { output: 'done' } } }),
      { params }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.task.status).toBe('completed');
  });

  it('completes task with failure', async () => {
    const result = { task: { id: 'rt_1', status: 'failed' }, routing: { status: 'escalated' } };
    mockCompleteTask.mockResolvedValue(result);
    const res = await POST(
      makeRequest('http://localhost/api/routing/tasks/rt_1/complete', { headers: { 'x-org-id': 'org_1' }, body: { success: false, error: 'timeout' } }),
      { params }
    );
    expect(res.status).toBe(200);
  });

  it('returns 404 when task not found', async () => {
    mockCompleteTask.mockRejectedValue(new Error('Task not found: rt_1'));
    const res = await POST(
      makeRequest('http://localhost/api/routing/tasks/rt_1/complete', { headers: { 'x-org-id': 'org_1' }, body: { success: true } }),
      { params }
    );
    expect(res.status).toBe(404);
  });

  it('publishes TASK_COMPLETED event', async () => {
    mockCompleteTask.mockResolvedValue({ task: { id: 'rt_1' }, routing: {} });
    await POST(
      makeRequest('http://localhost/api/routing/tasks/rt_1/complete', { headers: { 'x-org-id': 'org_1' }, body: { success: true } }),
      { params }
    );
    expect(mockPublishOrgEvent).toHaveBeenCalledWith('task.completed', expect.objectContaining({ orgId: 'org_1' }));
  });

  it('returns 500 on internal error', async () => {
    mockCompleteTask.mockRejectedValue(new Error('internal failure'));
    const res = await POST(
      makeRequest('http://localhost/api/routing/tasks/rt_1/complete', { headers: { 'x-org-id': 'org_1' }, body: { success: true } }),
      { params }
    );
    expect(res.status).toBe(500);
  });
});
