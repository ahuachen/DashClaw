import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db.js', () => ({ getSql: vi.fn(() => ({})) }));
vi.mock('@/lib/org.js', () => ({ getOrgId: vi.fn(() => 'org_test') }));
vi.mock('@/lib/repositories/messagesContext.repository.js', () => ({
  getThreadById: vi.fn(),
}));

const { getThreadById } = await import('@/lib/repositories/messagesContext.repository.js');

function requestFor(pathSuffix) {
  return new Request(`http://localhost/api/messages/threads/${pathSuffix}`);
}

describe('GET /api/messages/threads/[threadId]', () => {
  beforeEach(() => {
    getThreadById.mockReset();
  });

  it('returns 200 with the thread body when it exists', async () => {
    const { GET } = await import('@/api/messages/threads/[threadId]/route.js');
    getThreadById.mockResolvedValueOnce({
      id: 'mt_abc123',
      name: 'Incident #42',
      status: 'open',
      org_id: 'org_test',
    });

    const res = await GET(requestFor('mt_abc123'), { params: Promise.resolve({ threadId: 'mt_abc123' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thread.id).toBe('mt_abc123');
    expect(body.thread.name).toBe('Incident #42');
  });

  it('returns 404 when the thread does not exist in the org', async () => {
    const { GET } = await import('@/api/messages/threads/[threadId]/route.js');
    getThreadById.mockResolvedValueOnce(null);

    const res = await GET(requestFor('mt_missing'), { params: Promise.resolve({ threadId: 'mt_missing' }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it('returns 400 for an id without the mt_ prefix', async () => {
    const { GET } = await import('@/api/messages/threads/[threadId]/route.js');

    const res = await GET(requestFor('nope'), { params: Promise.resolve({ threadId: 'nope' }) });
    expect(res.status).toBe(400);
    expect(getThreadById).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    const { GET } = await import('@/api/messages/threads/[threadId]/route.js');
    getThreadById.mockRejectedValueOnce(new Error('db down'));

    const res = await GET(requestFor('mt_abc123'), { params: Promise.resolve({ threadId: 'mt_abc123' }) });
    expect(res.status).toBe(500);
  });
});
