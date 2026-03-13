import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const {
  mockSql,
  mockUpsertAgentPresence,
  mockEnsureAgentPresenceTable,
  mockPublishOrgEvent,
} = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockUpsertAgentPresence: vi.fn(),
  mockEnsureAgentPresenceTable: vi.fn(),
  mockPublishOrgEvent: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/repositories/agents.repository.js', () => ({
  upsertAgentPresence: mockUpsertAgentPresence,
  ensureAgentPresenceTable: mockEnsureAgentPresenceTable,
  listAgentsForOrg: vi.fn(async () => []),
  attachAgentConnections: vi.fn(async () => undefined),
}));
vi.mock('@/lib/events.js', () => ({
  EVENTS: {},
  publishOrgEvent: mockPublishOrgEvent,
}));

import { POST } from '@/api/agents/heartbeat/route.js';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL = 'postgres://unit-test';
  mockUpsertAgentPresence.mockResolvedValue(undefined);
  mockPublishOrgEvent.mockResolvedValue(undefined);
});

describe('/api/agents/heartbeat POST', () => {
  it('returns ok for a valid heartbeat', async () => {
    const res = await POST(makeRequest('http://localhost/api/agents/heartbeat', {
      headers: { 'x-org-id': 'org_1' },
      body: { agent_id: 'agent_1', status: 'online' },
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });

  it('calls upsertAgentPresence with full context', async () => {
    await POST(makeRequest('http://localhost/api/agents/heartbeat', {
      headers: { 'x-org-id': 'org_1' },
      body: {
        agent_id: 'agent_1',
        agent_name: 'Builder Agent',
        status: 'busy',
        current_task_id: 'task_99',
        metadata: { model: 'claude-3' },
      },
    }));

    expect(mockUpsertAgentPresence).toHaveBeenCalledWith(
      mockSql,
      'org_1',
      expect.objectContaining({
        agent_id: 'agent_1',
        agent_name: 'Builder Agent',
        status: 'busy',
        current_task_id: 'task_99',
        metadata: { model: 'claude-3' },
      })
    );
  });

  it('defaults status to online when not provided', async () => {
    await POST(makeRequest('http://localhost/api/agents/heartbeat', {
      headers: { 'x-org-id': 'org_1' },
      body: { agent_id: 'agent_1' },
    }));

    expect(mockUpsertAgentPresence).toHaveBeenCalledWith(
      mockSql,
      'org_1',
      expect.objectContaining({ status: 'online' })
    );
  });

  it('returns 400 when agent_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/agents/heartbeat', {
      headers: { 'x-org-id': 'org_1' },
      body: { status: 'online' },
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('agent_id');
  });

  it('returns 503 and initializes table on missing table error', async () => {
    mockUpsertAgentPresence.mockRejectedValue(new Error('relation agent_presence does not exist'));
    mockEnsureAgentPresenceTable.mockResolvedValue(undefined);

    const res = await POST(makeRequest('http://localhost/api/agents/heartbeat', {
      headers: { 'x-org-id': 'org_1' },
      body: { agent_id: 'agent_1' },
    }));

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.code).toBe('RETRY');
    expect(mockEnsureAgentPresenceTable).toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockUpsertAgentPresence.mockRejectedValue(new Error('connection refused'));

    const res = await POST(makeRequest('http://localhost/api/agents/heartbeat', {
      headers: { 'x-org-id': 'org_1' },
      body: { agent_id: 'agent_1' },
    }));

    expect(res.status).toBe(500);
  });

  it('fires a realtime event after successful heartbeat', async () => {
    await POST(makeRequest('http://localhost/api/agents/heartbeat', {
      headers: { 'x-org-id': 'org_1' },
      body: { agent_id: 'agent_1', status: 'online' },
    }));

    expect(mockPublishOrgEvent).toHaveBeenCalledWith(
      'agent.heartbeat',
      expect.objectContaining({ orgId: 'org_1', agent_id: 'agent_1', status: 'online' })
    );
  });
});
