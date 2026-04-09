# DashClaw MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a DashClaw MCP server exposing 8 governance tools and 4 resources over stdio (npm package) and Streamable HTTP (Next.js route), plus an updated Managed Agent example.

**Architecture:** Shared tool/resource handler functions in `mcp-server/lib/` called by two transport layers. The stdio binary uses `@modelcontextprotocol/server` SDK with `StdioServerTransport`. The Next.js route implements JSON-RPC directly (avoids Web API ↔ Node transport mismatch). Both call the same `DashClawClient` HTTP wrapper.

**Tech Stack:** `@modelcontextprotocol/server` + `zod` (stdio), native `fetch` (HTTP client), Vitest (tests), Next.js App Router (SSE route), Python (Managed Agent example).

**Spec:** `docs/superpowers/specs/2026-04-09-dashclaw-mcp-server-design.md`

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `mcp-server/package.json` | npm package config for `@dashclaw/mcp-server` |
| `mcp-server/.env.example` | Config template |
| `mcp-server/lib/client.js` | HTTP client wrapping DashClaw REST API |
| `mcp-server/lib/tools.js` | 8 tool definitions (name, description, schema) + handler functions |
| `mcp-server/lib/resources.js` | 4 resource definitions (URI, name, description) + handler functions |
| `mcp-server/lib/server.js` | MCP server factory — creates McpServer with all tools/resources |
| `mcp-server/bin/dashclaw-mcp.js` | CLI entry point — stdio transport |
| `mcp-server/README.md` | Package documentation |
| `app/api/mcp/route.js` | Next.js Streamable HTTP route — JSON-RPC handler |
| `examples/managed-agent-mcp/main.py` | Managed Agent + MCP integration example |
| `examples/managed-agent-mcp/requirements.txt` | Python dependencies |
| `examples/managed-agent-mcp/.env.example` | Example env config |
| `examples/managed-agent-mcp/README.md` | Example documentation |
| `__tests__/unit/mcp-client.test.js` | HTTP client tests |
| `__tests__/unit/mcp-tools.test.js` | Tool handler tests |
| `__tests__/unit/mcp-resources.test.js` | Resource handler tests |
| `__tests__/unit/mcp-route.test.js` | Next.js route tests |

### Modified Files

| File | Change |
|---|---|
| `package.json` (root) | Add `@modelcontextprotocol/server`, `zod` to dependencies |
| `CHANGELOG.md` | Add MCP server entry |
| `ROADMAP.md` | Move Managed Agents from "Exploring" to "Recently Shipped" |
| `PROJECT_DETAILS.md` | Add MCP server route and package |
| `README.md` | Update "Works With" section |
| `examples/README.md` | Add MCP example as recommended |
| `sdk/README.md` | Add MCP integration section |

---

### Task 1: HTTP Client

**Files:**
- Create: `mcp-server/lib/client.js`
- Test: `__tests__/unit/mcp-client.test.js`

- [ ] **Step 1: Write failing tests for the HTTP client**

```javascript
// __tests__/unit/mcp-client.test.js
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { DashClawClient } = await import('../../mcp-server/lib/client.js');

describe('DashClawClient', () => {
  let client;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new DashClawClient({
      url: 'http://localhost:3000',
      apiKey: 'oc_live_test123',
    });
  });

  describe('constructor', () => {
    it('strips trailing slash from URL', () => {
      const c = new DashClawClient({ url: 'http://localhost:3000/', apiKey: 'k' });
      expect(c.baseUrl).toBe('http://localhost:3000');
    });

    it('uses defaults when no args provided', () => {
      const c = new DashClawClient({});
      expect(c.baseUrl).toBe('http://localhost:3000');
      expect(c.apiKey).toBe('');
    });
  });

  describe('post()', () => {
    it('sends POST with JSON body and x-api-key header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ decision: 'allow' }),
      });

      const result = await client.post('/api/guard', { action_type: 'deploy' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/guard',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'oc_live_test123',
          },
          body: JSON.stringify({ action_type: 'deploy' }),
        }),
      );
      expect(result).toEqual({ decision: 'allow' });
    });

    it('returns error object on non-OK response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' }),
      });

      const result = await client.post('/api/guard', {});
      expect(result).toEqual({ error: 'Forbidden', _status: 403 });
    });

    it('returns error object on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await client.post('/api/guard', {});
      expect(result).toEqual({ error: 'Connection refused', _status: 0 });
    });
  });

  describe('get()', () => {
    it('sends GET with query params and x-api-key header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ policies: [] }),
      });

      const result = await client.get('/api/policies', { agent_id: 'bot1' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/policies?agent_id=bot1',
        expect.objectContaining({
          method: 'GET',
          headers: { 'x-api-key': 'oc_live_test123' },
        }),
      );
      expect(result).toEqual({ policies: [] });
    });

    it('omits query string when params are empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ capabilities: [] }),
      });

      await client.get('/api/capabilities', {});
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/capabilities',
        expect.anything(),
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/mcp-client.test.js`
Expected: FAIL — `mcp-server/lib/client.js` does not exist.

- [ ] **Step 3: Implement the HTTP client**

```javascript
// mcp-server/lib/client.js

/**
 * HTTP client for DashClaw REST API.
 * Used by MCP tool and resource handlers.
 */
export class DashClawClient {
  /**
   * @param {Object} options
   * @param {string} [options.url] - DashClaw instance URL
   * @param {string} [options.apiKey] - API key (oc_live_ prefix)
   * @param {string} [options.agentId] - Default agent ID for tool calls
   */
  constructor({ url, apiKey, agentId } = {}) {
    this.baseUrl = (url || 'http://localhost:3000').replace(/\/$/, '');
    this.apiKey = apiKey || '';
    this.agentId = agentId || '';
  }

  async post(path, body, { timeout = 10000 } = {}) {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });
      const data = await res.json();
      if (!res.ok) return { ...data, _status: res.status };
      return data;
    } catch (err) {
      return { error: err.message, _status: 0 };
    }
  }

  async get(path, params = {}, { timeout = 10000 } = {}) {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    );
    const qs = new URLSearchParams(filtered).toString();
    const url = qs ? `${this.baseUrl}${path}?${qs}` : `${this.baseUrl}${path}`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'x-api-key': this.apiKey },
        signal: AbortSignal.timeout(timeout),
      });
      const data = await res.json();
      if (!res.ok) return { ...data, _status: res.status };
      return data;
    } catch (err) {
      return { error: err.message, _status: 0 };
    }
  }

  async patch(path, body, { timeout = 10000 } = {}) {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });
      const data = await res.json();
      if (!res.ok) return { ...data, _status: res.status };
      return data;
    } catch (err) {
      return { error: err.message, _status: 0 };
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/mcp-client.test.js`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add mcp-server/lib/client.js __tests__/unit/mcp-client.test.js
git commit -m "feat(mcp): add DashClaw HTTP client"
```

---

### Task 2: Tool Definitions and Handlers

**Files:**
- Create: `mcp-server/lib/tools.js`
- Test: `__tests__/unit/mcp-tools.test.js`

- [ ] **Step 1: Write failing tests for tool handlers**

```javascript
// __tests__/unit/mcp-tools.test.js
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPatch = vi.fn();

vi.mock('../../mcp-server/lib/client.js', () => ({
  DashClawClient: vi.fn().mockImplementation(() => ({
    post: mockPost,
    get: mockGet,
    patch: mockPatch,
    agentId: 'default-agent',
  })),
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/mcp-tools.test.js`
Expected: FAIL — `mcp-server/lib/tools.js` does not exist.

- [ ] **Step 3: Implement tool definitions and handlers**

```javascript
// mcp-server/lib/tools.js

/**
 * DashClaw MCP tool definitions and handlers.
 * Tool definitions follow JSON Schema (for both MCP registerTool and JSON-RPC).
 * Handlers are pure functions that call DashClawClient and return text content.
 */

export const TOOL_DEFINITIONS = [
  {
    name: 'dashclaw_guard',
    description:
      'Evaluate DashClaw governance policies before taking a risky action. Call this BEFORE ' +
      'any action that modifies external systems, deploys code, sends messages, or touches ' +
      'production data. Returns a decision: "allow" (proceed), "warn" (proceed with caution), ' +
      '"block" (stop), or "require_approval" (wait for human in Mission Control). If the ' +
      'decision is "block", do NOT proceed with the action.',
    inputSchema: {
      type: 'object',
      properties: {
        action_type: { type: 'string', description: 'Category of action (e.g., deploy, send_email, database_write, api_call)' },
        declared_goal: { type: 'string', description: 'What you intend to do, in plain language' },
        risk_score: { type: 'integer', description: 'Estimated risk 0-100. Use 70+ for production systems.' },
        agent_id: { type: 'string', description: 'Override default agent ID' },
        systems_touched: { type: 'array', items: { type: 'string' }, description: 'Systems affected (e.g., production, database, email)' },
        reversible: { type: 'boolean', description: 'Whether the action can be undone' },
      },
      required: ['action_type', 'declared_goal', 'risk_score'],
    },
  },
  {
    name: 'dashclaw_record',
    description:
      'Record a governed action in DashClaw\'s audit trail. Use this to log significant ' +
      'decisions, completed tasks, or notable outcomes. Every important action the agent takes ' +
      'should be recorded for governance visibility in Mission Control and the Decisions ledger.',
    inputSchema: {
      type: 'object',
      properties: {
        action_type: { type: 'string', description: 'Category (e.g., research, analysis, code_change, deploy)' },
        declared_goal: { type: 'string', description: 'What was accomplished' },
        status: { type: 'string', enum: ['running', 'completed', 'failed', 'pending_approval'], description: 'Outcome status' },
        risk_score: { type: 'integer', description: 'Risk level 0-100 (default 30)' },
        agent_id: { type: 'string', description: 'Override default agent ID' },
        reasoning: { type: 'string', description: 'Why this action was chosen' },
        confidence: { type: 'integer', description: 'Confidence 0-100' },
        systems_touched: { type: 'array', items: { type: 'string' }, description: 'Systems affected' },
        reversible: { type: 'boolean', description: 'Whether the action can be undone' },
        output_summary: { type: 'string', description: 'Brief summary of what was produced' },
        tokens_in: { type: 'integer', description: 'Input tokens consumed' },
        tokens_out: { type: 'integer', description: 'Output tokens produced' },
        model: { type: 'string', description: 'Model used' },
        cost_estimate: { type: 'number', description: 'Estimated cost in USD' },
      },
      required: ['action_type', 'declared_goal', 'status'],
    },
  },
  {
    name: 'dashclaw_invoke',
    description:
      'Invoke a DashClaw-governed capability (external API). The capability is guarded ' +
      '(policy check), executed (HTTP call), and recorded (audit trail) automatically. Use ' +
      'this instead of making direct HTTP calls when the target API is registered as a DashClaw ' +
      'capability. Call dashclaw_capabilities_list first to discover available capability IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        capability_id: { type: 'string', description: 'The capability ID (e.g., cap_abc123)' },
        declared_goal: { type: 'string', description: 'What you\'re trying to accomplish' },
        agent_id: { type: 'string', description: 'Override default agent ID' },
        payload: { type: 'object', description: 'Request payload for the capability' },
      },
      required: ['capability_id', 'declared_goal'],
    },
  },
  {
    name: 'dashclaw_capabilities_list',
    description:
      'List available capabilities registered in DashClaw. Use this to discover what external ' +
      'APIs and tools are available before invoking them. Returns capability IDs, names, health ' +
      'status, and risk levels. Filter by category, risk level, or search term.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category: external_api, webhook, function' },
        risk_level: { type: 'string', description: 'Filter: low, medium, high, critical' },
        search: { type: 'string', description: 'Search by name or description' },
      },
    },
  },
  {
    name: 'dashclaw_policies_list',
    description:
      'List active governance policies. Use this to understand what rules govern your actions ' +
      'before taking them. Helps calibrate risk scores and know which action types require ' +
      'approval. Optionally filter to policies applying to a specific agent.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Filter to policies applying to a specific agent' },
      },
    },
  },
  {
    name: 'dashclaw_wait_for_approval',
    description:
      'Wait for a human to approve or deny a pending action in DashClaw Mission Control. ' +
      'Call this after a guard decision returns "require_approval" or after recording an ' +
      'action with status "pending_approval". Polls the action status until it changes. ' +
      'Default timeout is 300 seconds (5 minutes).',
    inputSchema: {
      type: 'object',
      properties: {
        action_id: { type: 'string', description: 'The action ID to wait on (e.g., act_abc123)' },
        timeout_seconds: { type: 'number', description: 'Max wait time (default 300)' },
        poll_interval_seconds: { type: 'number', description: 'Polling frequency (default 3)' },
      },
      required: ['action_id'],
    },
  },
  {
    name: 'dashclaw_session_start',
    description:
      'Register this agent session with DashClaw. Creates a session record that groups all ' +
      'subsequent actions for tracking and observability. Call this at the beginning of a task ' +
      'to establish a governance boundary.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent identifier (required)' },
        workspace: { type: 'string', description: 'Workspace or project context' },
        branch: { type: 'string', description: 'Git branch or task branch' },
      },
      required: ['agent_id'],
    },
  },
  {
    name: 'dashclaw_session_end',
    description:
      'Close a DashClaw session and update its status. Call this when the task is complete ' +
      'or if the session needs to be marked as failed. Provides a clean lifecycle boundary ' +
      'for governance reporting in Mission Control.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Session ID from dashclaw_session_start' },
        status: { type: 'string', enum: ['completed', 'failed', 'cancelled'], description: 'Final session status' },
        summary: { type: 'string', description: 'Brief description of what was accomplished' },
      },
      required: ['session_id', 'status'],
    },
  },
];

/**
 * Create tool handler functions bound to a DashClawClient instance.
 * Each handler accepts input args and returns a JSON string (MCP text content).
 * @param {import('./client.js').DashClawClient} client
 * @returns {Object<string, function>}
 */
export function createToolHandlers(client) {
  const agentId = (input) => input.agent_id || client.agentId;

  return {
    async dashclaw_guard(input) {
      const result = await client.post('/api/guard', {
        action_type: input.action_type,
        declared_goal: input.declared_goal,
        risk_score: input.risk_score,
        agent_id: agentId(input),
        systems_touched: input.systems_touched,
        reversible: input.reversible,
      }, { timeout: 10000 });
      return JSON.stringify(result);
    },

    async dashclaw_record(input) {
      const body = {
        action_type: input.action_type,
        declared_goal: input.declared_goal,
        status: input.status,
        risk_score: input.risk_score ?? 30,
        agent_id: agentId(input),
        reasoning: input.reasoning,
        confidence: input.confidence,
        systems_touched: input.systems_touched,
        reversible: input.reversible,
        output_summary: input.output_summary,
        tokens_in: input.tokens_in,
        tokens_out: input.tokens_out,
        model: input.model,
        cost_estimate: input.cost_estimate,
      };
      const result = await client.post('/api/actions', body, { timeout: 10000 });
      return JSON.stringify(result);
    },

    async dashclaw_invoke(input) {
      const result = await client.post(`/api/capabilities/${input.capability_id}/invoke`, {
        agent_id: agentId(input),
        declared_goal: input.declared_goal,
        payload: input.payload,
      }, { timeout: 30000 });
      return JSON.stringify(result);
    },

    async dashclaw_capabilities_list(input) {
      const result = await client.get('/api/capabilities', {
        category: input.category,
        risk_level: input.risk_level,
        search: input.search,
      }, { timeout: 10000 });
      return JSON.stringify(result);
    },

    async dashclaw_policies_list(input) {
      const result = await client.get('/api/policies', {
        agent_id: input.agent_id,
      }, { timeout: 10000 });
      return JSON.stringify(result);
    },

    async dashclaw_wait_for_approval(input) {
      const timeout = (input.timeout_seconds ?? 300) * 1000;
      const interval = (input.poll_interval_seconds ?? 3) * 1000;
      const start = Date.now();

      while (Date.now() - start < timeout) {
        const result = await client.get(`/api/actions/${input.action_id}`, {}, { timeout: 10000 });
        const status = result?.action?.status;

        if (status && status !== 'pending_approval') {
          return JSON.stringify({
            approved: status === 'completed',
            action: result.action,
            waited_seconds: Math.round((Date.now() - start) / 1000),
          });
        }

        await new Promise((r) => setTimeout(r, interval));
      }

      return JSON.stringify({
        approved: false,
        timed_out: true,
        action: { status: 'pending_approval' },
        waited_seconds: Math.round((Date.now() - start) / 1000),
      });
    },

    async dashclaw_session_start(input) {
      const result = await client.post('/api/sessions', {
        agent_id: input.agent_id,
        workspace: input.workspace,
        branch: input.branch,
      }, { timeout: 10000 });
      return JSON.stringify(result);
    },

    async dashclaw_session_end(input) {
      const result = await client.patch(`/api/sessions/${input.session_id}`, {
        status: input.status,
        summary: input.summary,
      }, { timeout: 10000 });
      return JSON.stringify(result);
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/mcp-tools.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add mcp-server/lib/tools.js __tests__/unit/mcp-tools.test.js
git commit -m "feat(mcp): add 8 tool definitions and handlers"
```

---

### Task 3: Resource Definitions and Handlers

**Files:**
- Create: `mcp-server/lib/resources.js`
- Test: `__tests__/unit/mcp-resources.test.js`

- [ ] **Step 1: Write failing tests for resource handlers**

```javascript
// __tests__/unit/mcp-resources.test.js
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();

vi.mock('../../mcp-server/lib/client.js', () => ({
  DashClawClient: vi.fn().mockImplementation(() => ({
    get: mockGet,
    agentId: 'default-agent',
  })),
}));

const { createResourceHandlers, RESOURCE_DEFINITIONS } = await import('../../mcp-server/lib/resources.js');
import { DashClawClient } from '../../mcp-server/lib/client.js';

describe('Resource Definitions', () => {
  it('exports exactly 4 resource definitions', () => {
    expect(RESOURCE_DEFINITIONS).toHaveLength(4);
  });

  it('every definition has uri, name, and description', () => {
    for (const def of RESOURCE_DEFINITIONS) {
      expect(def.uri).toBeTruthy();
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
    }
  });
});

describe('Resource Handlers', () => {
  let handlers;

  beforeEach(() => {
    vi.clearAllMocks();
    const client = new DashClawClient();
    handlers = createResourceHandlers(client);
  });

  describe('dashclaw://policies', () => {
    it('returns policies as JSON text', async () => {
      mockGet.mockResolvedValue({ policies: [{ id: 'gp_1', name: 'Block deploys' }] });

      const result = await handlers['dashclaw://policies']();

      expect(mockGet).toHaveBeenCalledWith('/api/policies', {}, { timeout: 10000 });
      expect(JSON.parse(result)).toEqual({ policies: [{ id: 'gp_1', name: 'Block deploys' }] });
    });
  });

  describe('dashclaw://capabilities', () => {
    it('returns capabilities as JSON text', async () => {
      mockGet.mockResolvedValue({ capabilities: [{ id: 'cap_1', name: 'Slack' }] });

      const result = await handlers['dashclaw://capabilities']();

      expect(mockGet).toHaveBeenCalledWith('/api/capabilities', {}, { timeout: 10000 });
      expect(JSON.parse(result)).toEqual({ capabilities: [{ id: 'cap_1', name: 'Slack' }] });
    });
  });

  describe('dashclaw://agent/{agent_id}/history', () => {
    it('returns action history for a specific agent', async () => {
      mockGet.mockResolvedValue({ actions: [{ id: 'act_1' }] });

      const result = await handlers['dashclaw://agent/{agent_id}/history']({ agent_id: 'bot1' });

      expect(mockGet).toHaveBeenCalledWith('/api/actions', { agent_id: 'bot1', limit: '50' }, { timeout: 10000 });
      expect(JSON.parse(result)).toEqual({ actions: [{ id: 'act_1' }] });
    });
  });

  describe('dashclaw://status', () => {
    it('combines health and operations summary', async () => {
      mockGet
        .mockResolvedValueOnce({ status: 'healthy', version: '2.11.0' })
        .mockResolvedValueOnce({ throughput: { last_24h: 150 } });

      const result = await handlers['dashclaw://status']();
      const parsed = JSON.parse(result);

      expect(parsed.health).toEqual({ status: 'healthy', version: '2.11.0' });
      expect(parsed.operations).toEqual({ throughput: { last_24h: 150 } });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/mcp-resources.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement resource definitions and handlers**

```javascript
// mcp-server/lib/resources.js

/**
 * DashClaw MCP resource definitions and handlers.
 * Resources provide read-only governance context.
 */

export const RESOURCE_DEFINITIONS = [
  {
    uri: 'dashclaw://policies',
    name: 'DashClaw Policies',
    description: 'Current active governance policy set for the organization.',
    mimeType: 'application/json',
  },
  {
    uri: 'dashclaw://capabilities',
    name: 'DashClaw Capabilities',
    description: 'Available capabilities and their health status.',
    mimeType: 'application/json',
  },
  {
    uri: 'dashclaw://agent/{agent_id}/history',
    name: 'Agent Action History',
    description: 'Recent action history for a specific agent (last 50 records).',
    mimeType: 'application/json',
    isTemplate: true,
  },
  {
    uri: 'dashclaw://status',
    name: 'DashClaw Status',
    description: 'Instance health and operational summary metrics.',
    mimeType: 'application/json',
  },
];

/**
 * Create resource handler functions bound to a DashClawClient instance.
 * Each handler returns a JSON string of the resource content.
 * @param {import('./client.js').DashClawClient} client
 * @returns {Object<string, function>}
 */
export function createResourceHandlers(client) {
  return {
    'dashclaw://policies': async () => {
      const result = await client.get('/api/policies', {}, { timeout: 10000 });
      return JSON.stringify(result);
    },

    'dashclaw://capabilities': async () => {
      const result = await client.get('/api/capabilities', {}, { timeout: 10000 });
      return JSON.stringify(result);
    },

    'dashclaw://agent/{agent_id}/history': async ({ agent_id }) => {
      const result = await client.get('/api/actions', {
        agent_id,
        limit: '50',
      }, { timeout: 10000 });
      return JSON.stringify(result);
    },

    'dashclaw://status': async () => {
      const [health, operations] = await Promise.all([
        client.get('/api/health', {}, { timeout: 10000 }),
        client.get('/api/operations/summary', {}, { timeout: 10000 }),
      ]);
      return JSON.stringify({ health, operations });
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/mcp-resources.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/lib/resources.js __tests__/unit/mcp-resources.test.js
git commit -m "feat(mcp): add 4 resource definitions and handlers"
```

---

### Task 4: MCP Server Factory

**Files:**
- Create: `mcp-server/lib/server.js`

- [ ] **Step 1: Implement the server factory**

The server factory creates a configured `McpServer` instance with all tools and resources registered. It's used by the stdio binary. The Next.js route uses the tool/resource handlers directly (no McpServer needed).

```javascript
// mcp-server/lib/server.js

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { DashClawClient } from './client.js';
import { TOOL_DEFINITIONS, createToolHandlers } from './tools.js';
import { RESOURCE_DEFINITIONS, createResourceHandlers } from './resources.js';

/**
 * Map JSON Schema types to Zod schemas for McpServer.registerTool().
 * Only handles the types used by DashClaw tool definitions.
 */
function jsonSchemaPropertyToZod(prop) {
  if (prop.enum) return z.enum(prop.enum);
  switch (prop.type) {
    case 'string': return z.string().describe(prop.description || '');
    case 'integer': return z.number().int().describe(prop.description || '');
    case 'number': return z.number().describe(prop.description || '');
    case 'boolean': return z.boolean().describe(prop.description || '');
    case 'array': return z.array(z.string()).describe(prop.description || '');
    case 'object': return z.record(z.unknown()).describe(prop.description || '');
    default: return z.unknown();
  }
}

function jsonSchemaToZod(schema) {
  const shape = {};
  const required = new Set(schema.required || []);
  for (const [key, prop] of Object.entries(schema.properties || {})) {
    const zodProp = jsonSchemaPropertyToZod(prop);
    shape[key] = required.has(key) ? zodProp : zodProp.optional();
  }
  return z.object(shape);
}

/**
 * Create a configured McpServer instance with all DashClaw tools and resources.
 * @param {Object} config
 * @param {string} [config.url] - DashClaw instance URL
 * @param {string} [config.apiKey] - API key
 * @param {string} [config.agentId] - Default agent ID
 * @returns {McpServer}
 */
export function createServer(config = {}) {
  const client = new DashClawClient(config);
  const toolHandlers = createToolHandlers(client);
  const resourceHandlers = createResourceHandlers(client);

  const server = new McpServer(
    { name: '@dashclaw/mcp-server', version: '1.0.0' },
    {
      capabilities: { tools: {}, resources: {} },
      instructions:
        'DashClaw governance tools. Call dashclaw_guard before risky actions. ' +
        'Use dashclaw_capabilities_list to discover available APIs. ' +
        'Record significant actions with dashclaw_record.',
    },
  );

  // Register tools
  for (const def of TOOL_DEFINITIONS) {
    const zodSchema = jsonSchemaToZod(def.inputSchema);
    server.registerTool(
      def.name,
      { description: def.description, inputSchema: zodSchema },
      async (args) => ({
        content: [{ type: 'text', text: await toolHandlers[def.name](args) }],
      }),
    );
  }

  // Register static resources
  for (const def of RESOURCE_DEFINITIONS) {
    if (def.isTemplate) continue;
    server.registerResource(
      def.name,
      def.uri,
      { description: def.description, mimeType: def.mimeType },
      async (uri) => ({
        contents: [{ uri: uri.href, text: await resourceHandlers[def.uri]() }],
      }),
    );
  }

  // Register template resources (agent history)
  const historyDef = RESOURCE_DEFINITIONS.find((d) => d.isTemplate);
  if (historyDef) {
    server.registerResource(
      historyDef.name,
      new ResourceTemplate(historyDef.uri, { list: undefined }),
      { description: historyDef.description, mimeType: historyDef.mimeType },
      async (uri, params) => ({
        contents: [{
          uri: uri.href,
          text: await resourceHandlers[historyDef.uri](params),
        }],
      }),
    );
  }

  return server;
}
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/lib/server.js
git commit -m "feat(mcp): add MCP server factory with tool/resource registration"
```

---

### Task 5: Package Config and stdio Binary

**Files:**
- Create: `mcp-server/package.json`
- Create: `mcp-server/.env.example`
- Create: `mcp-server/bin/dashclaw-mcp.js`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@dashclaw/mcp-server",
  "version": "1.0.0",
  "description": "MCP server for DashClaw governance — guard, record, invoke, and discover capabilities.",
  "type": "module",
  "bin": {
    "dashclaw-mcp": "./bin/dashclaw-mcp.js"
  },
  "main": "./lib/server.js",
  "exports": {
    ".": "./lib/server.js",
    "./client": "./lib/client.js",
    "./tools": "./lib/tools.js",
    "./resources": "./lib/resources.js"
  },
  "files": [
    "bin/",
    "lib/",
    "LICENSE",
    "README.md"
  ],
  "keywords": [
    "mcp",
    "model-context-protocol",
    "dashclaw",
    "ai-governance",
    "agent-governance"
  ],
  "author": "DashClaw",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ucsandman/DashClaw.git",
    "directory": "mcp-server"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "@modelcontextprotocol/server": "^1.0.0",
    "zod": "^3.25.0"
  }
}
```

- [ ] **Step 2: Create .env.example**

```bash
# DashClaw MCP Server Configuration
DASHCLAW_URL=http://localhost:3000
DASHCLAW_API_KEY=oc_live_your_key_here
DASHCLAW_AGENT_ID=my-agent
```

- [ ] **Step 3: Create the stdio binary**

```javascript
#!/usr/bin/env node

// mcp-server/bin/dashclaw-mcp.js

import { StdioServerTransport } from '@modelcontextprotocol/server';
import { createServer } from '../lib/server.js';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Parse CLI args: --url, --key, --agent-id
const args = process.argv.slice(2);
const config = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--url': config.url = args[++i]; break;
    case '--key': config.apiKey = args[++i]; break;
    case '--agent-id': config.agentId = args[++i]; break;
    case '--help':
      console.error(`Usage: dashclaw-mcp [options]

Options:
  --url <url>          DashClaw instance URL (default: http://localhost:3000)
  --key <key>          API key (oc_live_ prefix)
  --agent-id <id>      Default agent ID

Environment variables (fallback):
  DASHCLAW_URL         DashClaw instance URL
  DASHCLAW_API_KEY     API key
  DASHCLAW_AGENT_ID    Default agent ID`);
      process.exit(0);
  }
}

// Env vars as fallback
config.url = config.url || process.env.DASHCLAW_URL;
config.apiKey = config.apiKey || process.env.DASHCLAW_API_KEY;
config.agentId = config.agentId || process.env.DASHCLAW_AGENT_ID;

const server = createServer(config);
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('@dashclaw/mcp-server running on stdio');
```

- [ ] **Step 4: Commit**

```bash
git add mcp-server/package.json mcp-server/.env.example mcp-server/bin/dashclaw-mcp.js
git commit -m "feat(mcp): add npm package config and stdio binary"
```

---

### Task 6: Next.js Streamable HTTP Route

**Files:**
- Create: `app/api/mcp/route.js`
- Test: `__tests__/unit/mcp-route.test.js`

- [ ] **Step 1: Write failing tests for the JSON-RPC route**

```javascript
// __tests__/unit/mcp-route.test.js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPatch = vi.fn();

vi.mock('../../mcp-server/lib/client.js', () => ({
  DashClawClient: vi.fn().mockImplementation(() => ({
    post: mockPost,
    get: mockGet,
    patch: mockPatch,
    agentId: '',
  })),
}));

const { POST } = await import('../../app/api/mcp/route.js');

describe('POST /api/mcp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handles initialize request', async () => {
    const request = makeRequest('http://localhost:3000/api/mcp', {
      headers: { 'x-api-key': 'oc_live_test', 'content-type': 'application/json' },
      body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {} } },
    });

    const res = await POST(request);
    const data = await res.json();

    expect(data.jsonrpc).toBe('2.0');
    expect(data.id).toBe(1);
    expect(data.result.serverInfo.name).toBe('@dashclaw/mcp-server');
    expect(data.result.capabilities.tools).toBeDefined();
    expect(data.result.capabilities.resources).toBeDefined();
  });

  it('handles tools/list request', async () => {
    const request = makeRequest('http://localhost:3000/api/mcp', {
      headers: { 'x-api-key': 'oc_live_test' },
      body: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    });

    const res = await POST(request);
    const data = await res.json();

    expect(data.result.tools).toHaveLength(8);
    expect(data.result.tools[0].name).toBe('dashclaw_guard');
    expect(data.result.tools[0].inputSchema).toBeDefined();
  });

  it('handles tools/call for dashclaw_guard', async () => {
    mockPost.mockResolvedValue({ decision: 'allow', reason: 'low risk' });

    const request = makeRequest('http://localhost:3000/api/mcp', {
      headers: { 'x-api-key': 'oc_live_test' },
      body: {
        jsonrpc: '2.0', id: 3, method: 'tools/call',
        params: {
          name: 'dashclaw_guard',
          arguments: { action_type: 'deploy', declared_goal: 'test', risk_score: 20 },
        },
      },
    });

    const res = await POST(request);
    const data = await res.json();

    expect(data.result.content[0].type).toBe('text');
    expect(JSON.parse(data.result.content[0].text).decision).toBe('allow');
  });

  it('handles resources/list request', async () => {
    const request = makeRequest('http://localhost:3000/api/mcp', {
      headers: { 'x-api-key': 'oc_live_test' },
      body: { jsonrpc: '2.0', id: 4, method: 'resources/list', params: {} },
    });

    const res = await POST(request);
    const data = await res.json();

    expect(data.result.resources.length).toBeGreaterThanOrEqual(3);
  });

  it('handles resources/read for dashclaw://policies', async () => {
    mockGet.mockResolvedValue({ policies: [{ id: 'gp_1' }] });

    const request = makeRequest('http://localhost:3000/api/mcp', {
      headers: { 'x-api-key': 'oc_live_test' },
      body: { jsonrpc: '2.0', id: 5, method: 'resources/read', params: { uri: 'dashclaw://policies' } },
    });

    const res = await POST(request);
    const data = await res.json();

    expect(data.result.contents[0].uri).toBe('dashclaw://policies');
    expect(JSON.parse(data.result.contents[0].text).policies).toHaveLength(1);
  });

  it('returns method not found for unknown methods', async () => {
    const request = makeRequest('http://localhost:3000/api/mcp', {
      headers: { 'x-api-key': 'oc_live_test' },
      body: { jsonrpc: '2.0', id: 6, method: 'unknown/method', params: {} },
    });

    const res = await POST(request);
    const data = await res.json();

    expect(data.error.code).toBe(-32601);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/mcp-route.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement the JSON-RPC route**

```javascript
// app/api/mcp/route.js
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { DashClawClient } from '../../../mcp-server/lib/client.js';
import { TOOL_DEFINITIONS, createToolHandlers } from '../../../mcp-server/lib/tools.js';
import { RESOURCE_DEFINITIONS, createResourceHandlers } from '../../../mcp-server/lib/resources.js';

const SERVER_INFO = {
  name: '@dashclaw/mcp-server',
  version: '1.0.0',
};

const PROTOCOL_VERSION = '2025-03-26';

function jsonrpc(id, result) {
  return NextResponse.json({ jsonrpc: '2.0', id, result });
}

function jsonrpcError(id, code, message) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } });
}

/**
 * Resolve config from request headers.
 * The x-api-key header is already validated by middleware.
 * The route calls back into its own instance's API via localhost.
 */
function resolveConfig(request) {
  const apiKey = request.headers.get('x-api-key') || '';
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.DASHCLAW_URL || 'http://localhost:3000';
  return { url: origin, apiKey };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id, method, params } = body;

    const config = resolveConfig(request);
    const client = new DashClawClient(config);
    const toolHandlers = createToolHandlers(client);
    const resourceHandlers = createResourceHandlers(client);

    switch (method) {
      case 'initialize':
        return jsonrpc(id, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: SERVER_INFO,
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
          },
        });

      case 'notifications/initialized':
        return jsonrpc(id, {});

      case 'tools/list':
        return jsonrpc(id, {
          tools: TOOL_DEFINITIONS.map((def) => ({
            name: def.name,
            description: def.description,
            inputSchema: def.inputSchema,
          })),
        });

      case 'tools/call': {
        const { name, arguments: args } = params;
        const handler = toolHandlers[name];
        if (!handler) {
          return jsonrpcError(id, -32602, `Unknown tool: ${name}`);
        }
        const text = await handler(args || {});
        return jsonrpc(id, {
          content: [{ type: 'text', text }],
        });
      }

      case 'resources/list':
        return jsonrpc(id, {
          resources: RESOURCE_DEFINITIONS.filter((d) => !d.isTemplate).map((def) => ({
            uri: def.uri,
            name: def.name,
            description: def.description,
            mimeType: def.mimeType,
          })),
          resourceTemplates: RESOURCE_DEFINITIONS.filter((d) => d.isTemplate).map((def) => ({
            uriTemplate: def.uri,
            name: def.name,
            description: def.description,
            mimeType: def.mimeType,
          })),
        });

      case 'resources/read': {
        const { uri } = params;
        // Match static resources
        const staticHandler = resourceHandlers[uri];
        if (staticHandler) {
          const text = await staticHandler();
          return jsonrpc(id, { contents: [{ uri, text }] });
        }
        // Match template: dashclaw://agent/{agent_id}/history
        const historyMatch = uri.match(/^dashclaw:\/\/agent\/([^/]+)\/history$/);
        if (historyMatch) {
          const text = await resourceHandlers['dashclaw://agent/{agent_id}/history']({ agent_id: historyMatch[1] });
          return jsonrpc(id, { contents: [{ uri, text }] });
        }
        return jsonrpcError(id, -32602, `Unknown resource: ${uri}`);
      }

      case 'ping':
        return jsonrpc(id, {});

      default:
        return jsonrpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    console.error('MCP route error:', err);
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal error' } },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/mcp-route.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/mcp/route.js __tests__/unit/mcp-route.test.js
git commit -m "feat(mcp): add Next.js Streamable HTTP route for MCP"
```

---

### Task 7: Managed Agent MCP Example

**Files:**
- Create: `examples/managed-agent-mcp/main.py`
- Create: `examples/managed-agent-mcp/requirements.txt`
- Create: `examples/managed-agent-mcp/.env.example`
- Create: `examples/managed-agent-mcp/README.md`

- [ ] **Step 1: Create requirements.txt**

```
anthropic>=1.0.0
python-dotenv>=1.0.0
```

- [ ] **Step 2: Create .env.example**

```bash
# Anthropic API key for Managed Agents
ANTHROPIC_API_KEY=your_anthropic_key_here

# DashClaw instance (the MCP server runs here)
DASHCLAW_URL=http://localhost:3000
DASHCLAW_API_KEY=oc_live_your_key_here
```

- [ ] **Step 3: Create main.py**

```python
"""
Claude Managed Agent + DashClaw MCP Governance

The simplest way to govern a Claude Managed Agent with DashClaw.
Instead of custom tools and HTTP boilerplate, the agent connects
to DashClaw's MCP server and gets 8 governance tools automatically.

Requirements:
  pip install anthropic python-dotenv
  cp .env.example .env  # fill in your keys
"""

import os
import sys

from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
DASHCLAW_URL = os.environ.get("DASHCLAW_URL", "http://localhost:3000")
DASHCLAW_API_KEY = os.environ.get("DASHCLAW_API_KEY", "")

if not ANTHROPIC_API_KEY:
    print("Error: ANTHROPIC_API_KEY is required. Set it in .env or environment.")
    sys.exit(1)


def run_governed_session(task):
    """Run a governed managed agent session via MCP."""
    client = Anthropic()

    # 1. Create agent with DashClaw MCP server
    print("Creating governed agent (MCP)...")
    agent = client.beta.agents.create(
        name="DashClaw Governed Agent (MCP)",
        model="claude-sonnet-4-6",
        system=(
            "You are a governed research agent with DashClaw governance tools "
            "available via MCP. Before any risky action (external APIs, deploys, "
            "data modifications), call dashclaw_guard. Record significant outcomes "
            "with dashclaw_record. Use dashclaw_capabilities_list to discover "
            "available APIs."
        ),
        tools=[{"type": "agent_toolset_20260401"}],
        mcp_servers=[
            {
                "type": "url",
                "url": f"{DASHCLAW_URL}/api/mcp",
                "headers": {"x-api-key": DASHCLAW_API_KEY},
                "name": "dashclaw",
            }
        ],
    )
    print(f"  Agent ID: {agent.id}")

    # 2. Create environment (allow DashClaw + MCP)
    print("Creating environment...")
    environment = client.beta.environments.create(
        name="dashclaw-mcp-env",
        config={
            "type": "cloud",
            "networking": {
                "type": "limited",
                "allowed_hosts": [DASHCLAW_URL.replace("http://", "").replace("https://", "")],
                "allow_mcp_servers": True,
            },
        },
    )
    print(f"  Environment ID: {environment.id}")

    # 3. Start session
    print("Starting session...")
    session = client.beta.sessions.create(
        agent=agent.id,
        environment_id=environment.id,
        title=f"Governed (MCP): {task[:50]}",
    )
    print(f"  Session ID: {session.id}")

    # 4. Stream — no custom tool handling needed
    print(f"\nTask: {task}")
    print("-" * 60)

    with client.beta.sessions.events.stream(session.id) as stream:
        client.beta.sessions.events.send(
            session.id,
            events=[
                {
                    "type": "user.message",
                    "content": [{"type": "text", "text": task}],
                }
            ],
        )

        for event in stream:
            match event.type:
                case "agent.message":
                    for block in event.content:
                        if hasattr(block, "text"):
                            print(block.text, end="")
                case "agent.tool_use":
                    print(f"\n  [Built-in: {event.name}]")
                case "agent.mcp_tool_use":
                    print(f"\n  [DashClaw: {event.name}]")
                case "session.status_idle":
                    stop = event.stop_reason
                    if stop and stop.type == "end_turn":
                        print("\n\nAgent finished.")
                        break
                case "session.status_terminated":
                    print("\n  [Session terminated]")
                    break
                case "session.error":
                    msg = event.error.message if hasattr(event, "error") and event.error else "unknown"
                    print(f"\n  [Error: {msg}]")

    print(f"\nGovernance trail: {DASHCLAW_URL}/decisions")

    # 5. Cleanup
    try:
        client.beta.agents.archive(agent.id)
        client.beta.environments.archive(environment.id)
    except Exception:
        pass


if __name__ == "__main__":
    task = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "Research the x402 payment protocol. Use dashclaw_guard before any "
        "external API calls. Record your findings with dashclaw_record when done."
    )
    run_governed_session(task)
```

- [ ] **Step 4: Create README.md**

```markdown
# Claude Managed Agent + DashClaw MCP

The **recommended** way to govern a Claude Managed Agent with DashClaw. Uses MCP (Model Context Protocol) so the agent gets governance tools automatically — no custom tool definitions, no HTTP boilerplate.

Compare: the [custom tools example](../managed-agent-governed/) is ~410 lines. This MCP version is ~80 lines.

## How It Works

The agent connects to DashClaw's MCP server via a single config line:

```python
mcp_servers=[{
    "type": "url",
    "url": f"{DASHCLAW_URL}/api/mcp",
    "headers": {"x-api-key": DASHCLAW_API_KEY},
    "name": "dashclaw",
}]
```

This gives the agent 8 governance tools and 4 resources automatically:

| Tool | Purpose |
|---|---|
| `dashclaw_guard` | Check policies before risky actions |
| `dashclaw_record` | Log actions to audit trail |
| `dashclaw_invoke` | Execute governed capabilities |
| `dashclaw_capabilities_list` | Discover available APIs |
| `dashclaw_policies_list` | See active governance policies |
| `dashclaw_wait_for_approval` | Wait for human approval |
| `dashclaw_session_start` | Register session |
| `dashclaw_session_end` | Close session |

## Setup

```bash
cd examples/managed-agent-mcp
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Anthropic API key and DashClaw instance URL
```

## Run

```bash
# Default task
python main.py

# Custom task
python main.py "Analyze our API performance. Guard before writing to production."
```

## Watch It Live

While the agent runs, open your DashClaw instance:

- **Mission Control** (`/mission-control`) — see governed actions in real time
- **Decisions** (`/decisions`) — full audit trail
- **Capabilities** (`/capabilities`) — invocation history

## vs Custom Tools

| | MCP (this example) | Custom Tools |
|---|---|---|
| Lines of code | ~80 | ~410 |
| Tool handling | Automatic (MCP protocol) | Manual (HTTP + result routing) |
| Setup | One config line | Tool definitions + HTTP client |
| Governance tools | 8 tools + 4 resources | 3 tools |
```

- [ ] **Step 5: Commit**

```bash
git add examples/managed-agent-mcp/
git commit -m "feat(mcp): add Managed Agent MCP governed example"
```

---

### Task 8: Install Dependencies

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Install MCP SDK and Zod in the root project**

```bash
npm install @modelcontextprotocol/server zod
```

- [ ] **Step 2: Install MCP server package dependencies**

```bash
cd mcp-server && npm install && cd ..
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

Run: `npx vitest run --run`
Expected: All existing tests pass. All new MCP tests pass.

- [ ] **Step 4: Commit dependency changes**

```bash
git add package.json package-lock.json mcp-server/package.json mcp-server/package-lock.json
git commit -m "chore: install @modelcontextprotocol/server and zod dependencies"
```

---

### Task 9: MCP Server README

**Files:**
- Create: `mcp-server/README.md`

- [ ] **Step 1: Write the README**

```markdown
# @dashclaw/mcp-server

MCP server for [DashClaw](https://github.com/ucsandman/DashClaw) governance. Exposes guard, record, invoke, and discovery tools over [Model Context Protocol](https://modelcontextprotocol.io/).

## Quick Start

### Claude Desktop / Claude Code (stdio)

```bash
npx @dashclaw/mcp-server --url https://your-dashclaw.vercel.app --key oc_live_xxx
```

Or add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dashclaw": {
      "command": "npx",
      "args": ["@dashclaw/mcp-server"],
      "env": {
        "DASHCLAW_URL": "https://your-dashclaw.vercel.app",
        "DASHCLAW_API_KEY": "oc_live_xxx"
      }
    }
  }
}
```

### Claude Managed Agents (Streamable HTTP)

If you're running DashClaw, the MCP endpoint is built in at `/api/mcp`:

```python
agent = client.beta.agents.create(
    name="Governed Agent",
    model="claude-sonnet-4-6",
    tools=[{"type": "agent_toolset_20260401"}],
    mcp_servers=[{
        "type": "url",
        "url": "https://your-dashclaw.vercel.app/api/mcp",
        "headers": {"x-api-key": "oc_live_xxx"},
        "name": "dashclaw"
    }],
)
```

## Tools

| Tool | Description |
|---|---|
| `dashclaw_guard` | Evaluate policies before risky actions |
| `dashclaw_record` | Log actions to audit trail |
| `dashclaw_invoke` | Execute governed capabilities |
| `dashclaw_capabilities_list` | Discover available APIs |
| `dashclaw_policies_list` | See active governance policies |
| `dashclaw_wait_for_approval` | Wait for human approval |
| `dashclaw_session_start` | Register agent session |
| `dashclaw_session_end` | Close agent session |

## Resources

| URI | Description |
|---|---|
| `dashclaw://policies` | Active policy set |
| `dashclaw://capabilities` | Available capabilities and health |
| `dashclaw://agent/{agent_id}/history` | Recent action history |
| `dashclaw://status` | Instance health and metrics |

## Configuration

| CLI Arg | Env Var | Default | Description |
|---|---|---|---|
| `--url` | `DASHCLAW_URL` | `http://localhost:3000` | DashClaw instance URL |
| `--key` | `DASHCLAW_API_KEY` | (empty) | API key (`oc_live_` prefix) |
| `--agent-id` | `DASHCLAW_AGENT_ID` | (empty) | Default agent ID |

CLI args take precedence over environment variables.
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/README.md
git commit -m "docs(mcp): add MCP server README"
```

---

### Task 10: Documentation Updates

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `ROADMAP.md`
- Modify: `PROJECT_DETAILS.md`
- Modify: `README.md`
- Modify: `examples/README.md`
- Modify: `sdk/README.md`

- [ ] **Step 1: Update CHANGELOG.md**

Add under `## [2.12.0]` (or next version) → `### Added`:

```markdown
- **DashClaw MCP Server**: New `@dashclaw/mcp-server` npm package exposing DashClaw governance as an MCP server. 8 tools (guard, record, invoke, capabilities_list, policies_list, wait_for_approval, session_start, session_end) and 4 resources (policies, capabilities, agent history, status). Dual transport: stdio for Claude Code/Desktop, Streamable HTTP at `/api/mcp` for Claude Managed Agents.
- **Managed Agent MCP Example**: New `examples/managed-agent-mcp/` — the recommended way to govern Claude Managed Agents with DashClaw. ~80 lines vs ~410 in the custom tools example. One config line gives the agent full governance.
```

- [ ] **Step 2: Update ROADMAP.md**

Move "Claude Managed Agents Integration" from "Exploring" to "Recently Shipped" and expand:

```markdown
- **v2.12** — DashClaw MCP Server (`@dashclaw/mcp-server`), dual-transport governance (stdio + Streamable HTTP at `/api/mcp`), 8 tools + 4 resources, Managed Agent MCP example
```

- [ ] **Step 3: Update PROJECT_DETAILS.md**

Add to the route table:

```markdown
| `POST /api/mcp` | MCP Streamable HTTP endpoint — JSON-RPC handler for MCP tool calls and resource reads. Powers `@dashclaw/mcp-server` remote transport. |
```

Add to Framework Integration Examples section:

```markdown
Working examples for governed agent patterns across frameworks: OpenAI, Anthropic, LangGraph, CrewAI, AutoGen, Claude Managed Agents (custom tools), and **Claude Managed Agents (MCP, recommended)**. Each example demonstrates the full governance loop within its framework's execution model. See `examples/README.md` for the full list.
```

- [ ] **Step 4: Update README.md**

In the "Works With" section, add or update:

```markdown
- **Claude Managed Agents (MCP)** — One config line: point `mcp_servers` at `/api/mcp` for instant governance
```

- [ ] **Step 5: Update examples/README.md**

Add the MCP example as recommended:

```markdown
### Claude Managed Agents (MCP) ⭐ Recommended

`managed-agent-mcp/` — The simplest way to govern a Claude Managed Agent. Uses DashClaw's MCP server — one config line gives the agent 8 governance tools and 4 resources. ~80 lines.
```

- [ ] **Step 6: Update sdk/README.md**

Add MCP section to framework integrations:

```markdown
### MCP Server (Zero-Code Integration)

If your agent supports MCP (Claude Code, Claude Desktop, Managed Agents), you can skip the SDK entirely:

```json
{
  "mcpServers": {
    "dashclaw": {
      "command": "npx",
      "args": ["@dashclaw/mcp-server"],
      "env": { "DASHCLAW_URL": "...", "DASHCLAW_API_KEY": "oc_live_..." }
    }
  }
}
```

The MCP server exposes the same governance surface as the SDK (guard, record, invoke, wait for approval) plus discovery (capabilities, policies) and session lifecycle.
```

- [ ] **Step 7: Run docs check**

```bash
npm run docs:check
npm run openapi:check
npm run api:inventory:generate
```

- [ ] **Step 8: Commit all doc changes**

```bash
git add CHANGELOG.md ROADMAP.md PROJECT_DETAILS.md README.md examples/README.md sdk/README.md docs/
git commit -m "docs: add MCP server to all documentation surfaces"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run --run
```

Expected: All tests pass (existing + 4 new test files).

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No lint errors in new files.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds (new route compiles, imports resolve).

- [ ] **Step 4: Verify docs checks pass**

```bash
npm run openapi:check
npm run api:inventory:check
```

- [ ] **Step 5: Manual smoke test (stdio)**

```bash
cd mcp-server && echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node bin/dashclaw-mcp.js --url http://localhost:3000
```

Expected: Returns JSON with 8 tools listed.

- [ ] **Step 6: Commit if any fixups needed**

```bash
git add -A && git commit -m "fix: address verification findings"
```
