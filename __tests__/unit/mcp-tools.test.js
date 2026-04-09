// __tests__/unit/mcp-tools.test.js
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPatch = vi.fn();

vi.mock('../../mcp-server/lib/client.js', () => ({
  DashClawClient: vi.fn().mockImplementation(function () {
    this.post = mockPost;
    this.get = mockGet;
    this.patch = mockPatch;
    this.agentId = 'default-agent';
  }),
}));

const { createToolHandlers, TOOL_DEFINITIONS } = await import('../../mcp-server/lib/tools.js');
import { DashClawClient } from '../../mcp-server/lib/client.js';

describe('Tool Definitions', () => {
  it('exports exactly 8 tool definitions', () => {
    expect(TOOL_DEFINITIONS).toHaveLength(8);
  });

  it('every definition has name, description, and inputSchema', () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(def.name).toBeTruthy();
      expect(def.description.length).toBeGreaterThan(50);
      expect(def.inputSchema).toBeDefined();
      expect(def.inputSchema.type).toBe('object');
    }
  });
});

describe('Tool Handlers', () => {
  let handlers;

  beforeEach(() => {
    vi.clearAllMocks();
    const client = new DashClawClient();
    handlers = createToolHandlers(client);
  });

  describe('dashclaw_guard', () => {
    it('calls POST /api/guard and returns decision', async () => {
      mockPost.mockResolvedValue({ decision: 'allow', reason: 'low risk' });

      const result = await handlers.dashclaw_guard({
        action_type: 'deploy',
        declared_goal: 'Deploy to staging',
        risk_score: 30,
      });

      expect(mockPost).toHaveBeenCalledWith('/api/guard', {
        action_type: 'deploy',
        declared_goal: 'Deploy to staging',
        risk_score: 30,
        agent_id: 'default-agent',
      }, { timeout: 10000 });
      expect(result).toContain('"decision":"allow"');
    });

    it('uses provided agent_id over default', async () => {
      mockPost.mockResolvedValue({ decision: 'block' });

      await handlers.dashclaw_guard({
        action_type: 'deploy',
        declared_goal: 'test',
        risk_score: 50,
        agent_id: 'custom-agent',
      });

      expect(mockPost).toHaveBeenCalledWith('/api/guard', expect.objectContaining({
        agent_id: 'custom-agent',
      }), expect.anything());
    });
  });

  describe('dashclaw_record', () => {
    it('calls POST /api/actions and returns action record', async () => {
      mockPost.mockResolvedValue({
        action: { id: '1', action_id: 'act_abc' },
        action_id: 'act_abc',
      });

      const result = await handlers.dashclaw_record({
        action_type: 'research',
        declared_goal: 'Analyzed logs',
        status: 'completed',
      });

      expect(mockPost).toHaveBeenCalledWith('/api/actions', expect.objectContaining({
        action_type: 'research',
        declared_goal: 'Analyzed logs',
        status: 'completed',
        agent_id: 'default-agent',
      }), { timeout: 10000 });
      expect(result).toContain('act_abc');
    });
  });

  describe('dashclaw_invoke', () => {
    it('calls POST /api/capabilities/:id/invoke with payload', async () => {
      mockPost.mockResolvedValue({
        success: true,
        action_id: 'act_xyz',
        result: { data: 'response' },
      });

      const result = await handlers.dashclaw_invoke({
        capability_id: 'cap_123',
        declared_goal: 'Send notification',
        payload: { message: 'hello' },
      });

      expect(mockPost).toHaveBeenCalledWith('/api/capabilities/cap_123/invoke', {
        agent_id: 'default-agent',
        declared_goal: 'Send notification',
        payload: { message: 'hello' },
      }, { timeout: 30000 });
      expect(result).toContain('act_xyz');
    });
  });

  describe('dashclaw_capabilities_list', () => {
    it('calls GET /api/capabilities with filters', async () => {
      mockGet.mockResolvedValue({ capabilities: [{ id: 'cap_1', name: 'Slack' }] });

      const result = await handlers.dashclaw_capabilities_list({
        category: 'external_api',
      });

      expect(mockGet).toHaveBeenCalledWith('/api/capabilities', {
        category: 'external_api',
        risk_level: undefined,
        search: undefined,
      }, { timeout: 10000 });
      expect(result).toContain('Slack');
    });
  });

  describe('dashclaw_policies_list', () => {
    it('calls GET /api/policies with optional agent_id', async () => {
      mockGet.mockResolvedValue({ policies: [{ id: 'gp_1', name: 'No prod deploys' }] });

      const result = await handlers.dashclaw_policies_list({ agent_id: 'bot1' });

      expect(mockGet).toHaveBeenCalledWith('/api/policies', { agent_id: 'bot1' }, { timeout: 10000 });
      expect(result).toContain('No prod deploys');
    });
  });

  describe('dashclaw_wait_for_approval', () => {
    it('polls action status until approved', async () => {
      mockGet
        .mockResolvedValueOnce({ action: { status: 'pending_approval' } })
        .mockResolvedValueOnce({ action: { status: 'completed', id: 'act_1' } });

      const result = await handlers.dashclaw_wait_for_approval({
        action_id: 'act_1',
        poll_interval_seconds: 0.01,
      });

      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(result).toContain('"approved":true');
    });

    it('returns timeout when max wait exceeded', async () => {
      mockGet.mockResolvedValue({ action: { status: 'pending_approval' } });

      const result = await handlers.dashclaw_wait_for_approval({
        action_id: 'act_1',
        timeout_seconds: 0.02,
        poll_interval_seconds: 0.01,
      });

      expect(result).toContain('"timed_out":true');
    });
  });

  describe('dashclaw_session_start', () => {
    it('calls POST /api/sessions', async () => {
      mockPost.mockResolvedValue({ session: { id: 'sess_1', status: 'active' } });

      const result = await handlers.dashclaw_session_start({
        agent_id: 'my-agent',
        workspace: 'research',
      });

      expect(mockPost).toHaveBeenCalledWith('/api/sessions', {
        agent_id: 'my-agent',
        workspace: 'research',
        branch: undefined,
      }, { timeout: 10000 });
      expect(result).toContain('sess_1');
    });
  });

  describe('dashclaw_session_end', () => {
    it('calls PATCH /api/sessions/:id', async () => {
      mockPatch.mockResolvedValue({ session: { id: 'sess_1', status: 'completed' } });

      const result = await handlers.dashclaw_session_end({
        session_id: 'sess_1',
        status: 'completed',
        summary: 'Research done',
      });

      expect(mockPatch).toHaveBeenCalledWith('/api/sessions/sess_1', {
        status: 'completed',
        summary: 'Research done',
      }, { timeout: 10000 });
      expect(result).toContain('completed');
    });
  });
});
