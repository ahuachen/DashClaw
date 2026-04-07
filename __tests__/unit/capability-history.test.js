import { describe, expect, it, vi } from 'vitest';
import { getCapabilityHistory } from '../../app/lib/capability-history.js';

function makeSqlMock(responses) {
  const queue = [...responses];
  return vi.fn((strings) => {
    if (Array.isArray(strings) && strings.length === 1 && strings[0] === '') {
      return Promise.resolve([]);
    }
    const next = queue.shift() ?? [];
    if (next instanceof Error) {
      return Promise.reject(next);
    }
    return Promise.resolve(next);
  });
}

describe('getCapabilityHistory', () => {
  it('falls back to legacy action_records columns when runtime fields are unavailable', async () => {
    const missingColumn = new Error('column "output_summary" does not exist');
    missingColumn.code = '42703';

    const sql = makeSqlMock([
      missingColumn,
      [{
        action_id: 'act_legacy_1',
        action_type: 'capability_invoke',
        status: 'completed',
        agent_id: 'agent_1',
        declared_goal: 'Send Slack message',
        timestamp_start: '2026-04-07T10:00:00.000Z',
      }],
    ]);

    const history = await getCapabilityHistory(sql, 'org_1', {
      capability_id: 'cap_1',
      name: 'Send Slack Message',
      slug: 'send-slack-message',
    });

    expect(history.capability_id).toBe('cap_1');
    expect(history.events).toHaveLength(1);
    expect(history.events[0]).toMatchObject({
      action_id: 'act_legacy_1',
      action_type: 'capability_invoke',
      status: 'completed',
      agent_id: 'agent_1',
      declared_goal: 'Send Slack message',
      output_summary: null,
      error_message: null,
      duration_ms: null,
      timestamp_start: '2026-04-07T10:00:00.000Z',
      timestamp_end: null,
    });
  });
});
