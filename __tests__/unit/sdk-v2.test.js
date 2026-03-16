import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashClaw, ApprovalDeniedError, GuardBlockedError } from '../../sdk/dashclaw.js';

/**
 * Unit tests for the v2 SDK surface (sdk/dashclaw.js).
 * Every public method is tested for correct URL, HTTP method, body, and query params.
 * waitForApproval is covered separately in hitl.test.js.
 */

function mockFetch(data = {}, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => data,
  });
}

describe('DashClaw v2 SDK', () => {
  let claw;

  beforeEach(() => {
    claw = new DashClaw({
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-key',
      agentId: 'test-agent',
    });
    global.fetch = mockFetch({ ok: true });
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('throws if baseUrl is missing', () => {
      expect(() => new DashClaw({ apiKey: 'k', agentId: 'a' })).toThrow('baseUrl is required');
    });

    it('throws if apiKey is missing', () => {
      expect(() => new DashClaw({ baseUrl: 'http://x', agentId: 'a' })).toThrow('apiKey is required');
    });

    it('throws if agentId is missing', () => {
      expect(() => new DashClaw({ baseUrl: 'http://x', apiKey: 'k' })).toThrow('agentId is required');
    });

    it('strips trailing slash from baseUrl', () => {
      const c = new DashClaw({ baseUrl: 'http://x/', apiKey: 'k', agentId: 'a' });
      expect(c.baseUrl).toBe('http://x');
    });
  });

  // --- _request internals ---

  describe('_request', () => {
    it('sends x-api-key header', async () => {
      await claw.guard({ action_type: 'test' });
      const [, opts] = fetch.mock.calls[0];
      expect(opts.headers['x-api-key']).toBe('test-key');
    });

    it('throws with reason from governance block responses', async () => {
      global.fetch = mockFetch({ reason: 'Blocked by cost policy', error: 'generic' }, false, 403);
      await expect(claw.guard({ action_type: 'test' })).rejects.toThrow('Blocked by cost policy');
    });

    it('throws with error field when no reason', async () => {
      global.fetch = mockFetch({ error: 'Not found' }, false, 404);
      await expect(claw.guard({ action_type: 'test' })).rejects.toThrow('Not found');
    });

    it('throws with status code when no reason or error', async () => {
      global.fetch = mockFetch({}, false, 500);
      await expect(claw.guard({ action_type: 'test' })).rejects.toThrow('Request failed with status 500');
    });

    it('attaches status and details to error', async () => {
      global.fetch = mockFetch({ error: 'Bad', details: { field: 'x' } }, false, 422);
      try {
        await claw.guard({ action_type: 'test' });
      } catch (err) {
        expect(err.status).toBe(422);
        expect(err.details).toEqual({ field: 'x' });
      }
    });
  });

  // --- guard ---

  describe('guard', () => {
    it('POSTs to /api/guard with context and agent_id', async () => {
      await claw.guard({ action_type: 'deploy', risk_score: 80 });
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/guard');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.action_type).toBe('deploy');
      expect(body.risk_score).toBe(80);
      expect(body.agent_id).toBe('test-agent');
    });

    it('allows overriding agent_id in context', async () => {
      await claw.guard({ action_type: 'test', agent_id: 'other-agent' });
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.agent_id).toBe('other-agent');
    });
  });

  // --- createAction ---

  describe('createAction', () => {
    it('POSTs to /api/actions with action and agent_id', async () => {
      await claw.createAction({ action_type: 'api_call', declared_goal: 'Fetch data', risk_score: 30 });
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/actions');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.action_type).toBe('api_call');
      expect(body.declared_goal).toBe('Fetch data');
      expect(body.agent_id).toBe('test-agent');
    });
  });

  // --- updateOutcome ---

  describe('updateOutcome', () => {
    it('PATCHes to /api/actions/:id with outcome', async () => {
      await claw.updateOutcome('act_123', { status: 'completed', output_summary: 'Done' });
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/actions/act_123');
      expect(opts.method).toBe('PATCH');
      const body = JSON.parse(opts.body);
      expect(body.status).toBe('completed');
      expect(body.output_summary).toBe('Done');
      expect(body.timestamp_end).toBeDefined();
    });

    it('preserves explicit timestamp_end', async () => {
      const ts = '2026-01-01T00:00:00.000Z';
      await claw.updateOutcome('act_123', { status: 'completed', timestamp_end: ts });
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.timestamp_end).toBe(ts);
    });
  });

  // --- recordAssumption ---

  describe('recordAssumption', () => {
    it('POSTs to /api/assumptions with assumption payload', async () => {
      const assumption = { action_id: 'act_1', assumption: 'User is admin', basis: 'Role check' };
      await claw.recordAssumption(assumption);
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/assumptions');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual(assumption);
    });
  });

  // --- heartbeat ---

  describe('heartbeat', () => {
    it('POSTs to /api/agents/heartbeat with defaults', async () => {
      await claw.heartbeat();
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/agents/heartbeat');
      const body = JSON.parse(opts.body);
      expect(body.agent_id).toBe('test-agent');
      expect(body.status).toBe('online');
      expect(body.metadata).toBeNull();
    });

    it('accepts custom status and metadata', async () => {
      await claw.heartbeat('busy', { task: 'indexing' });
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.status).toBe('busy');
      expect(body.metadata).toEqual({ task: 'indexing' });
    });
  });

  // --- reportConnections ---

  describe('reportConnections', () => {
    it('POSTs to /api/agents/connections', async () => {
      const connections = [{ type: 'stripe', status: 'active' }];
      await claw.reportConnections(connections);
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/agents/connections');
      const body = JSON.parse(opts.body);
      expect(body.agent_id).toBe('test-agent');
      expect(body.connections).toEqual(connections);
    });
  });

  // --- registerOpenLoop ---

  describe('registerOpenLoop', () => {
    it('POSTs to /api/actions/loops with positional args', async () => {
      await claw.registerOpenLoop('act_1', 'background_indexing', 'Indexing docs', { priority: 'high' });
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/actions/loops');
      const body = JSON.parse(opts.body);
      expect(body.action_id).toBe('act_1');
      expect(body.loop_type).toBe('background_indexing');
      expect(body.description).toBe('Indexing docs');
      expect(body.metadata).toEqual({ priority: 'high' });
    });

    it('sends null metadata when omitted', async () => {
      await claw.registerOpenLoop('act_1', 'polling', 'Polling API');
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.metadata).toBeNull();
    });
  });

  // --- resolveOpenLoop ---

  describe('resolveOpenLoop', () => {
    it('PATCHes to /api/actions/loops/:id', async () => {
      await claw.resolveOpenLoop('loop_1', 'resolved', 'Indexed 42 files');
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/actions/loops/loop_1');
      expect(opts.method).toBe('PATCH');
      const body = JSON.parse(opts.body);
      expect(body.status).toBe('resolved');
      expect(body.resolution).toBe('Indexed 42 files');
    });
  });

  // --- getSignals ---

  describe('getSignals', () => {
    it('GETs /api/actions/signals', async () => {
      await claw.getSignals();
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/actions/signals');
      expect(opts.method).toBe('GET');
      expect(opts.body).toBeUndefined();
    });
  });

  // --- getLearningVelocity ---

  describe('getLearningVelocity', () => {
    it('GETs /api/learning/analytics/velocity with query params', async () => {
      await claw.getLearningVelocity(14);
      const [url] = fetch.mock.calls[0];
      expect(url).toContain('/api/learning/analytics/velocity');
      expect(url).toContain('agent_id=test-agent');
      expect(url).toContain('lookback_days=14');
    });

    it('defaults to 30 days', async () => {
      await claw.getLearningVelocity();
      const [url] = fetch.mock.calls[0];
      expect(url).toContain('lookback_days=30');
    });
  });

  // --- getLearningCurves ---

  describe('getLearningCurves', () => {
    it('GETs /api/learning/analytics/curves with query params', async () => {
      await claw.getLearningCurves(90);
      const [url] = fetch.mock.calls[0];
      expect(url).toContain('/api/learning/analytics/curves');
      expect(url).toContain('agent_id=test-agent');
      expect(url).toContain('lookback_days=90');
    });

    it('defaults to 60 days', async () => {
      await claw.getLearningCurves();
      const [url] = fetch.mock.calls[0];
      expect(url).toContain('lookback_days=60');
    });
  });

  // --- renderPrompt ---

  describe('renderPrompt', () => {
    it('POSTs to /api/prompts/render with template and variables', async () => {
      await claw.renderPrompt({
        template_id: 'tmpl_1',
        version_id: 'pv_1',
        variables: { name: 'Alice' },
        record: true,
      });
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/prompts/render');
      const body = JSON.parse(opts.body);
      expect(body.template_id).toBe('tmpl_1');
      expect(body.version_id).toBe('pv_1');
      expect(body.variables).toEqual({ name: 'Alice' });
      expect(body.agent_id).toBe('test-agent');
      expect(body.record).toBe(true);
    });

    it('defaults record to false', async () => {
      await claw.renderPrompt({ template_id: 't', variables: {} });
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.record).toBe(false);
    });
  });

  // --- createScorer ---

  describe('createScorer', () => {
    it('POSTs to /api/evaluations/scorers with positional args', async () => {
      await claw.createScorer('quality', 'contains', { keywords: ['ok'] }, 'A scorer');
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/evaluations/scorers');
      const body = JSON.parse(opts.body);
      expect(body.name).toBe('quality');
      expect(body.scorer_type).toBe('contains');
      expect(body.config).toEqual({ keywords: ['ok'] });
      expect(body.description).toBe('A scorer');
    });

    it('defaults config and description to null', async () => {
      await claw.createScorer('basic', 'regex');
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.config).toBeNull();
      expect(body.description).toBeNull();
    });
  });

  // --- createScoringProfile ---

  describe('createScoringProfile', () => {
    it('POSTs to /api/scoring/profiles with profile object', async () => {
      const profile = { name: 'deploy-quality', composite_method: 'weighted_average', dimensions: [] };
      await claw.createScoringProfile(profile);
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/scoring/profiles');
      expect(JSON.parse(opts.body)).toEqual(profile);
    });
  });

  // --- mapCompliance ---

  describe('mapCompliance', () => {
    it('GETs /api/compliance/map with framework query param', async () => {
      await claw.mapCompliance('soc2');
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toContain('/api/compliance/map');
      expect(url).toContain('framework=soc2');
      expect(opts.method).toBe('GET');
    });
  });

  // --- getProofReport ---

  describe('getProofReport', () => {
    it('GETs /api/policies/proof with format param', async () => {
      await claw.getProofReport('pdf');
      const [url] = fetch.mock.calls[0];
      expect(url).toContain('/api/policies/proof');
      expect(url).toContain('format=pdf');
    });

    it('defaults to json format', async () => {
      await claw.getProofReport();
      const [url] = fetch.mock.calls[0];
      expect(url).toContain('format=json');
    });
  });

  // --- getActivityLogs ---

  describe('getActivityLogs', () => {
    it('GETs /api/activity with filter params', async () => {
      await claw.getActivityLogs({ agent_id: 'bot-1', limit: 50 });
      const [url] = fetch.mock.calls[0];
      expect(url).toContain('/api/activity');
      expect(url).toContain('agent_id=bot-1');
      expect(url).toContain('limit=50');
    });

    it('works with no filters', async () => {
      await claw.getActivityLogs();
      const [url] = fetch.mock.calls[0];
      // No query string when params is empty object — URLSearchParams('') yields ''
      expect(url).toBe('http://localhost:3000/api/activity');
    });
  });

  // --- createWebhook ---

  describe('createWebhook', () => {
    it('POSTs to /api/webhooks with url and events', async () => {
      await claw.createWebhook('https://example.com/hook', ['action.created', 'guard.blocked']);
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/webhooks');
      const body = JSON.parse(opts.body);
      expect(body.url).toBe('https://example.com/hook');
      expect(body.events).toEqual(['action.created', 'guard.blocked']);
    });

    it('defaults events to null', async () => {
      await claw.createWebhook('https://example.com/hook');
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.events).toBeNull();
    });
  });

  // --- Error classes ---

  describe('GuardBlockedError', () => {
    it('uses reason from decision', () => {
      const err = new GuardBlockedError({ reason: 'Cost too high' });
      expect(err.message).toBe('Cost too high');
      expect(err.name).toBe('GuardBlockedError');
      expect(err.decision).toEqual({ reason: 'Cost too high' });
    });

    it('falls back to default message', () => {
      const err = new GuardBlockedError({});
      expect(err.message).toBe('Action blocked by policy');
    });
  });

  describe('ApprovalDeniedError', () => {
    it('stores message and decision', () => {
      const err = new ApprovalDeniedError('Denied', 'cancelled');
      expect(err.message).toBe('Denied');
      expect(err.name).toBe('ApprovalDeniedError');
      expect(err.decision).toBe('cancelled');
    });
  });
});
