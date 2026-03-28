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

function req(query = '') {
  return makeRequest(`http://localhost/api/actions/act_1/messages${query}`, {
    headers: { 'x-org-id': 'org_test' },
  });
}

describe('/api/actions/[actionId]/messages?summary=true', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns summary with count and participants when summary=true', async () => {
    const summaryResult = [{
      total: '3',
      participants: 'agent-a,agent-b',
      correlation: 'explicit',
      first_message_at: '2026-01-01T00:00:00Z',
      last_message_at: '2026-01-01T00:05:00Z',
    }];

    mockSql = createSqlMock({ taggedResponses: [summaryResult] });
    const ctx = { params: Promise.resolve({ actionId: 'act_1' }) };
    const res = await GET(req('?summary=true'), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(3);
    expect(data.participants).toEqual(['agent-a', 'agent-b']);
    expect(data.correlation).toBe('explicit');
    expect(data.first_message_at).toBe('2026-01-01T00:00:00Z');
    expect(data.last_message_at).toBe('2026-01-01T00:05:00Z');
  });

  it('returns zero summary when no messages found', async () => {
    mockSql = createSqlMock({ taggedResponses: [[]] });
    const ctx = { params: Promise.resolve({ actionId: 'act_1' }) };
    const res = await GET(req('?summary=true'), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(0);
    expect(data.participants).toEqual([]);
  });

  it('still returns full messages when summary param is absent', async () => {
    const messages = [
      { id: 'msg_1', from_agent_id: 'a1', to_agent_id: 'a2', message_type: 'action', subject: 'Test', body: 'Hello', thread_id: 't1', urgent: false, created_at: '2026-01-01T00:00:00Z', action_id: 'act_1' },
    ];
    mockSql = createSqlMock({ taggedResponses: [messages] });
    const ctx = { params: Promise.resolve({ actionId: 'act_1' }) };
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.messages).toHaveLength(1);
    expect(data.messages[0].body).toBe('Hello');
  });
});
