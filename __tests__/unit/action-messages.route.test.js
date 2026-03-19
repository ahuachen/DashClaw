import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqlMock, makeRequest } from '../helpers.js';

let mockSql;

const { mockGetOrgId } = vi.hoisted(() => ({
  mockGetOrgId: vi.fn(() => 'org_test'),
}));

vi.mock('@/lib/db.js', () => ({
  getSql: () => mockSql,
}));
vi.mock('@/lib/org.js', () => ({
  getOrgId: mockGetOrgId,
}));

import { GET } from '@/api/actions/[actionId]/messages/route.js';

function req() {
  return makeRequest('http://localhost/api/actions/act_1/messages', {
    headers: { 'x-org-id': 'org_test' },
  });
}

describe('/api/actions/[actionId]/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid action_id (no prefix)', async () => {
    mockSql = createSqlMock();
    const ctx = { params: Promise.resolve({ actionId: 'invalid-id' }) };
    const res = await GET(req(), ctx);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Valid action_id required');
  });

  it('returns 400 for empty action_id', async () => {
    mockSql = createSqlMock();
    const ctx = { params: Promise.resolve({ actionId: '' }) };
    const res = await GET(req(), ctx);
    expect(res.status).toBe(400);
  });

  it('returns explicit matches when messages have action_id set', async () => {
    const explicitMessages = [
      { id: 'msg_1', from_agent_id: 'a1', to_agent_id: 'a2', message_type: 'action', subject: 'Test', body: 'Hello', thread_id: 't1', urgent: false, created_at: '2026-01-01T00:00:00Z', action_id: 'act_1' },
      { id: 'msg_2', from_agent_id: 'a2', to_agent_id: 'a1', message_type: 'info', subject: 'Reply', body: 'World', thread_id: 't1', urgent: false, created_at: '2026-01-01T00:01:00Z', action_id: 'act_1' },
    ];

    mockSql = createSqlMock({ taggedResponses: [explicitMessages] });
    const ctx = { params: Promise.resolve({ actionId: 'act_1' }) };
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.correlation).toBe('explicit');
    expect(data.total).toBe(2);
    expect(data.messages).toHaveLength(2);
    expect(data.messages[0].match_type).toBe('explicit');
    expect(data.messages[1].match_type).toBe('explicit');
  });

  it('falls back to time-window correlation when no explicit matches', async () => {
    const actionRecord = {
      agent_id: 'agent_1',
      timestamp_start: '2026-01-01T00:00:00Z',
      timestamp_end: '2026-01-01T00:05:00Z',
    };
    const correlatedMessages = [
      { id: 'msg_3', from_agent_id: 'agent_1', to_agent_id: 'a2', message_type: 'status', subject: 'Status', body: 'Running', thread_id: 't2', urgent: false, created_at: '2026-01-01T00:02:00Z', action_id: null },
    ];

    // First call returns empty (no explicit matches), second returns the action record, third returns correlated messages
    mockSql = createSqlMock({
      taggedResponses: [[], [actionRecord], correlatedMessages],
    });

    const ctx = { params: Promise.resolve({ actionId: 'act_2' }) };
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.correlation).toBe('time_window');
    expect(data.total).toBe(1);
    expect(data.messages[0].match_type).toBe('time_window');
  });

  it('returns empty array when action does not exist', async () => {
    // First call: no explicit matches; second call: no action record found
    mockSql = createSqlMock({ taggedResponses: [[], []] });

    const ctx = { params: Promise.resolve({ actionId: 'act_missing' }) };
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.messages).toEqual([]);
    expect(data.correlation).toBe('none');
    expect(data.total).toBe(0);
  });

  it('returns correlation "none" when time-window finds no messages', async () => {
    const actionRecord = {
      agent_id: 'agent_1',
      timestamp_start: '2026-01-01T00:00:00Z',
      timestamp_end: '2026-01-01T00:05:00Z',
    };

    // First: no explicit, second: action exists, third: no correlated messages
    mockSql = createSqlMock({ taggedResponses: [[], [actionRecord], []] });

    const ctx = { params: Promise.resolve({ actionId: 'act_3' }) };
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.messages).toEqual([]);
    expect(data.correlation).toBe('none');
    expect(data.total).toBe(0);
  });

  it('accepts ar_ prefix as valid action_id', async () => {
    mockSql = createSqlMock({ taggedResponses: [[]] });
    const ctx = { params: Promise.resolve({ actionId: 'ar_123' }) };
    // Should not return 400 — ar_ is a valid prefix
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
  });

  it('returns 500 on database error', async () => {
    mockSql = createSqlMock();
    // Override the mock to throw on call
    mockSql = () => { throw new Error('db connection failed'); };
    mockSql.query = vi.fn();

    const ctx = { params: Promise.resolve({ actionId: 'act_1' }) };
    const res = await GET(req(), ctx);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Failed to fetch messages');
  });
});
