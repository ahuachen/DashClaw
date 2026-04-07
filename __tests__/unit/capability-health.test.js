import { describe, expect, it, vi } from 'vitest';
import { getCapabilityHealthSummary } from '../../app/lib/capability-health.js';

function makeSqlMock(responses) {
  const queue = [...responses];
  return vi.fn(() => Promise.resolve(queue.shift() ?? []));
}

describe('getCapabilityHealthSummary', () => {
  it('derives healthy status from successful recent invocations', async () => {
    const sql = makeSqlMock([
      [{
        total_invocations: '4',
        successful_invocations: '4',
        failed_invocations: '0',
        pending_approvals: '0',
        last_success_at: '2026-04-07T00:00:00.000Z',
        last_failure_at: null,
      }],
      [],
    ]);

    const summary = await getCapabilityHealthSummary(sql, 'org_1', {
      slug: 'research-agent',
      health_status: 'unknown',
    });

    expect(summary.status).toBe('healthy');
    expect(summary.total_invocations).toBe(4);
    expect(summary.success_rate_7d).toBe(100);
    expect(summary.recent_errors).toEqual([]);
  });

  it('derives failing status when recent invocations only failed', async () => {
    const sql = makeSqlMock([
      [{
        total_invocations: '3',
        successful_invocations: '0',
        failed_invocations: '3',
        pending_approvals: '0',
        last_success_at: null,
        last_failure_at: '2026-04-07T01:00:00.000Z',
      }],
      [{ error_message: 'downstream timeout', timestamp_start: '2026-04-07T01:00:00.000Z' }],
    ]);

    const summary = await getCapabilityHealthSummary(sql, 'org_1', {
      slug: 'research-agent',
      health_status: 'healthy',
    });

    expect(summary.status).toBe('failing');
    expect(summary.failed_invocations).toBe(3);
    expect(summary.recent_errors[0].message).toBe('downstream timeout');
  });

  it('returns untested when there is no invocation history', async () => {
    const sql = makeSqlMock([
      [{
        total_invocations: '0',
        successful_invocations: '0',
        failed_invocations: '0',
        pending_approvals: '0',
        last_success_at: null,
        last_failure_at: null,
      }],
      [],
    ]);

    const summary = await getCapabilityHealthSummary(sql, 'org_1', {
      slug: 'research-agent',
      health_status: 'unknown',
    });

    expect(summary.status).toBe('untested');
    expect(summary.success_rate_7d).toBe(0);
  });
});
