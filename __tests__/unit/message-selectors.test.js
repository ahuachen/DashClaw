import { describe, expect, it } from 'vitest';
import { selectUrgentUnread } from '@/lib/messages/selectors.js';

describe('selectUrgentUnread', () => {
  const base = (over = {}) => ({
    id: 'm1',
    from_agent_id: 'agent_a',
    to_agent_id: 'agent_b',
    message_type: 'info',
    status: 'sent',
    urgent: false,
    is_read: false,
    created_at: '2026-04-14T12:00:00.000Z',
    ...over,
  });

  it('returns unread messages (status=sent, is_read=false)', () => {
    const msgs = [
      base({ id: 'unread', is_read: false, status: 'sent' }),
      base({ id: 'read', is_read: true, status: 'sent' }),
      base({ id: 'archived', is_read: false, status: 'archived' }),
    ];
    const result = selectUrgentUnread(msgs);
    expect(result.map(m => m.id)).toEqual(['unread']);
  });

  it('sorts urgent ahead of non-urgent, then by created_at desc', () => {
    const msgs = [
      base({ id: 'old_urgent', urgent: true, created_at: '2026-04-14T10:00:00.000Z' }),
      base({ id: 'new_normal', urgent: false, created_at: '2026-04-14T12:00:00.000Z' }),
      base({ id: 'new_urgent', urgent: true, created_at: '2026-04-14T11:00:00.000Z' }),
    ];
    const result = selectUrgentUnread(msgs);
    expect(result.map(m => m.id)).toEqual(['new_urgent', 'old_urgent', 'new_normal']);
  });

  it('treats urgent as truthy (tolerates boolean or numeric shape)', () => {
    const msgs = [
      base({ id: 'bool_urgent', urgent: true, created_at: '2026-04-14T09:00:00.000Z' }),
      base({ id: 'num_urgent', urgent: 1, created_at: '2026-04-14T08:00:00.000Z' }),
      base({ id: 'bool_normal', urgent: false, created_at: '2026-04-14T12:00:00.000Z' }),
      base({ id: 'num_normal', urgent: 0, created_at: '2026-04-14T11:00:00.000Z' }),
    ];
    const result = selectUrgentUnread(msgs);
    // urgent (true or 1) sorted by time desc, then non-urgent sorted by time desc
    expect(result.map(m => m.id)).toEqual(['bool_urgent', 'num_urgent', 'bool_normal', 'num_normal']);
  });

  it('caps result length with limit option (default 5)', () => {
    const msgs = Array.from({ length: 10 }, (_, i) =>
      base({ id: `m${i}`, created_at: `2026-04-14T12:0${i}:00.000Z` })
    );
    expect(selectUrgentUnread(msgs)).toHaveLength(5);
    expect(selectUrgentUnread(msgs, { limit: 3 })).toHaveLength(3);
  });

  it('returns empty array for null/undefined/non-array input', () => {
    expect(selectUrgentUnread(null)).toEqual([]);
    expect(selectUrgentUnread(undefined)).toEqual([]);
    expect(selectUrgentUnread('nope')).toEqual([]);
  });
});
