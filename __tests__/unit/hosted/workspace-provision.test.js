import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  provisionHostedWorkspace,
  getHostedWorkspace,
  deleteHostedWorkspace,
  findExpiredWorkspaces,
} from '../../../app/lib/repositories/hosted-workspace.repository.js';

function createSqlMock() {
  return vi.fn();
}

describe('hosted-workspace repository', () => {
  let sql;
  beforeEach(() => {
    sql = createSqlMock();
  });

  it('provisionHostedWorkspace creates org + api_key and returns plaintext key once', async () => {
    sql.mockResolvedValueOnce([]); // org insert
    sql.mockResolvedValueOnce([]); // api_key insert
    const res = await provisionHostedWorkspace(sql, {
      trialDays: 30,
      trialActionCap: 10000,
      label: 'trial',
    });
    expect(res.orgId).toMatch(/^org_/);
    expect(res.apiKey).toMatch(/^oc_live_[0-9a-f]{32}$/);
    expect(res.keyPrefix).toMatch(/^oc_live_/);
    expect(res.expiresAt).toBeTypeOf('string');
    expect(sql.mock.calls.length).toBe(2);
  });

  it('provisionHostedWorkspace propagates errors from inserts', async () => {
    sql.mockRejectedValueOnce(new Error('db down'));
    await expect(
      provisionHostedWorkspace(sql, { trialDays: 30, trialActionCap: 10000 }),
    ).rejects.toThrow(/db down/);
  });

  it('getHostedWorkspace returns null when not found', async () => {
    sql.mockResolvedValueOnce([]);
    expect(await getHostedWorkspace(sql, 'org_missing')).toBeNull();
  });

  it('getHostedWorkspace returns workspace when found', async () => {
    sql.mockResolvedValueOnce([{
      id: 'org_abc',
      name: 'Trial',
      hosted_mode: true,
      trial_ends_at: '2026-05-18T00:00:00Z',
      trial_action_cap: 10000,
      trial_actions_used: 42,
    }]);
    const res = await getHostedWorkspace(sql, 'org_abc');
    expect(res).toEqual({
      orgId: 'org_abc',
      name: 'Trial',
      hostedMode: true,
      trialEndsAt: '2026-05-18T00:00:00Z',
      trialActionCap: 10000,
      trialActionsUsed: 42,
    });
  });

  it('deleteHostedWorkspace refuses to delete non-hosted orgs', async () => {
    sql.mockResolvedValueOnce([{ hosted_mode: false }]);
    await expect(deleteHostedWorkspace(sql, 'org_real')).rejects.toThrow(/not a hosted/);
  });

  it('findExpiredWorkspaces returns orgs past trialEndsAt', async () => {
    sql.mockResolvedValueOnce([{ id: 'org_old' }, { id: 'org_older' }]);
    const res = await findExpiredWorkspaces(sql, { now: new Date('2026-06-01T00:00:00Z') });
    expect(res).toEqual(['org_old', 'org_older']);
  });
});
