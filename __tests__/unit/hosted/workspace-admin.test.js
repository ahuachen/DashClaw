import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sqlMock = vi.fn();
vi.mock('@neondatabase/serverless', () => ({ neon: vi.fn(() => sqlMock) }));

const { GET, DELETE } = await import('../../../app/api/hosted/workspaces/[workspaceId]/route.js');

function req(method, id, { role = 'admin' } = {}) {
  return new Request(`http://localhost:3000/api/hosted/workspaces/${id}`, {
    method,
    headers: {
      'x-api-key': 'admin-key',
      'x-org-id': 'org_admin',
      'x-org-role': role,
    },
  });
}

function paramsPromise(workspaceId) {
  return Promise.resolve({ workspaceId });
}

describe('GET /api/hosted/workspaces/:id', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([]); // default for any unstubbed calls
    process.env.DASHCLAW_HOSTED = 'true';
    process.env.DATABASE_URL = 'postgres://fake';
    globalThis.__dashclaw_sql = sqlMock;
  });

  afterEach(() => {
    delete globalThis.__dashclaw_sql;
  });

  it('returns 404 when flag off', async () => {
    delete process.env.DASHCLAW_HOSTED;
    const res = await GET(req('GET', 'org_x'), { params: paramsPromise('org_x') });
    expect(res.status).toBe(404);
  });

  it('returns 403 when role is not admin/owner', async () => {
    const res = await GET(req('GET', 'org_x', { role: 'member' }), { params: paramsPromise('org_x') });
    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown workspace', async () => {
    sqlMock.mockResolvedValueOnce([]);
    const res = await GET(req('GET', 'org_missing'), { params: paramsPromise('org_missing') });
    expect(res.status).toBe(404);
  });

  it('returns 404 for non-hosted org', async () => {
    sqlMock.mockResolvedValueOnce([{
      id: 'org_real', name: 'Real', hosted_mode: false,
      trial_ends_at: null, trial_action_cap: null, trial_actions_used: 0,
    }]);
    const res = await GET(req('GET', 'org_real'), { params: paramsPromise('org_real') });
    expect(res.status).toBe(404);
  });

  it('returns workspace summary for known hosted id', async () => {
    sqlMock.mockResolvedValueOnce([{
      id: 'org_x', name: 'Trial', hosted_mode: true,
      trial_ends_at: '2026-05-18T00:00:00Z', trial_action_cap: 10000, trial_actions_used: 17,
    }]);
    const res = await GET(req('GET', 'org_x'), { params: paramsPromise('org_x') });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      workspace_id: 'org_x',
      trial_ends_at: '2026-05-18T00:00:00Z',
      trial_actions_used: 17,
    });
  });
});

describe('DELETE /api/hosted/workspaces/:id', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([]);
    process.env.DASHCLAW_HOSTED = 'true';
    globalThis.__dashclaw_sql = sqlMock;
  });

  afterEach(() => {
    delete globalThis.__dashclaw_sql;
  });

  it('refuses to delete non-hosted orgs (404)', async () => {
    sqlMock.mockResolvedValueOnce([{ hosted_mode: false }]);
    const res = await DELETE(req('DELETE', 'org_real'), { params: paramsPromise('org_real') });
    expect(res.status).toBe(404);
  });

  it('deletes a hosted workspace (200)', async () => {
    sqlMock.mockResolvedValueOnce([{ hosted_mode: true }]); // existence check
    sqlMock.mockResolvedValueOnce([]); // revoke keys
    sqlMock.mockResolvedValueOnce([]); // delete org
    const res = await DELETE(req('DELETE', 'org_x'), { params: paramsPromise('org_x') });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ deleted: true, workspace_id: 'org_x' });
  });
});
