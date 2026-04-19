#!/usr/bin/env node

/**
 * DashClaw MCP Server for OpenCode
 *
 * Exposes DashClaw governance tools over stdio (OpenCode standard transport).
 * Tools: dashclaw_guard, dashclaw_record, dashclaw_wait_for_approval,
 *        dashclaw_session_start, dashclaw_session_end,
 *        dashclaw_capabilities_list, dashclaw_policies_list
 *
 * Usage:
 *   npx @dashclaw/opencode --url https://your-dashclaw.app --key oc_live_xxx
 *
 * Or via env vars:
 *   DASHCLAW_URL=https://your-dashclaw.app DASHCLAW_API_KEY=oc_live_xxx npx @dashclaw/opencode
 */

import { McpServer, fromJsonSchema } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// --- CLI arg parsing ---
const args = process.argv.slice(2);
const config = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--url':
      config.url = args[++i];
      break;
    case '--key':
      config.apiKey = args[++i];
      break;
    case '--agent-id':
      config.agentId = args[++i];
      break;
    case '--help':
      console.error(`Usage: dashclaw-opencode-mcp [options]

Options:
  --url <url>          DashClaw instance URL (default: http://localhost:3000)
  --key <key>          API key (oc_live_ prefix)
  --agent-id <id>      Default agent ID

Environment variables (fallback):
  DASHCLAW_URL         DashClaw instance URL
  DASHCLAW_API_KEY     API key
  DASHCLAW_AGENT_ID    Default agent ID`);
      process.exit(0);
      break;
  }
}

config.url = config.url || process.env.DASHCLAW_URL;
config.apiKey = config.apiKey || process.env.DASHCLAW_API_KEY;
config.agentId = config.agentId || process.env.DASHCLAW_AGENT_ID;

// --- HTTP client ---
class DashClawClient {
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

// --- Tool definitions ---
const TOOL_DEFINITIONS = [
  {
    name: 'dashclaw_guard',
    description:
      'Evaluate DashClaw governance policies before taking a risky action. Call this BEFORE ' +
      'any action that modifies external systems, deploys code, sends messages, or touches ' +
      'production data. Returns a decision: "allow" (proceed), "warn" (proceed with caution), ' +
      '"block" (stop), or "require_approval" (wait for human). If the decision is "block", ' +
      'do NOT proceed with the action.',
    inputSchema: {
      type: 'object',
      properties: {
        action_type: { type: 'string', description: 'Category of action (e.g., code_change, deploy, file_write, shell_exec)' },
        declared_goal: { type: 'string', description: 'What you intend to do, in plain language' },
        risk_score: { type: 'integer', description: 'Estimated risk 0-100. Use 70+ for production systems, 50+ for destructive ops.' },
        agent_id: { type: 'string', description: 'Override default agent ID' },
        systems_touched: { type: 'array', items: { type: 'string' }, description: 'Systems affected (e.g., filesystem, git, production, database)' },
        reversible: { type: 'boolean', description: 'Whether the action can be undone' },
      },
      required: ['action_type', 'declared_goal', 'risk_score'],
    },
  },
  {
    name: 'dashclaw_record',
    description:
      'Record a governed action in DashClaw\'s audit trail. Log significant decisions, ' +
      'completed tasks, or notable outcomes. Every important action the agent takes should ' +
      'be recorded for governance visibility in Mission Control and the Decisions ledger.',
    inputSchema: {
      type: 'object',
      properties: {
        action_type: { type: 'string', description: 'Category (e.g., code_change, analysis, deploy, file_write, shell_exec)' },
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
    name: 'dashclaw_wait_for_approval',
    description:
      'Wait for a human to approve or deny a pending action in DashClaw Mission Control. ' +
      'Call this after a guard decision returns "require_approval" or after recording an action ' +
      'with status "pending_approval". Polls until status changes. Default timeout: 300s.',
    inputSchema: {
      type: 'object',
      properties: {
        action_id: { type: 'string', description: 'The action ID to wait on (e.g., act_abc123)' },
        timeout_seconds: { type: 'number', description: 'Max wait time in seconds (default 300)' },
        poll_interval_seconds: { type: 'number', description: 'Polling frequency in seconds (default 3)' },
      },
      required: ['action_id'],
    },
  },
  {
    name: 'dashclaw_session_start',
    description:
      'Register this agent session with DashClaw. Creates a session record that groups all ' +
      'subsequent actions for tracking and observability. Call this at the start of a coding ' +
      'task to establish a governance boundary.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent identifier (required)' },
        workspace: { type: 'string', description: 'Project directory or workspace context' },
        branch: { type: 'string', description: 'Git branch being worked on' },
      },
      required: ['agent_id'],
    },
  },
  {
    name: 'dashclaw_session_end',
    description:
      'Close a DashClaw session and update its status. Call this when the coding task is ' +
      'complete or if the session needs to be marked as failed. Provides a clean lifecycle ' +
      'boundary for governance reporting.',
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
  {
    name: 'dashclaw_capabilities_list',
    description:
      'List available capabilities registered in DashClaw. Discover what external APIs and ' +
      'tools are governed. Returns capability IDs, names, health status, and risk levels.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category: external_api, webhook, function' },
        risk_level: { type: 'string', description: 'Filter by risk: low, medium, high, critical' },
        search: { type: 'string', description: 'Search by name or description' },
      },
    },
  },
  {
    name: 'dashclaw_policies_list',
    description:
      'List active governance policies. Understand what rules govern your actions before ' +
      'taking them. Helps calibrate risk scores and know which action types require approval.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Filter to policies applying to a specific agent' },
      },
    },
  },
];

// --- Tool handlers ---
function createHandlers(client) {
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
      const result = await client.post('/api/actions', {
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
  };
}

// --- Build and start server ---
const client = new DashClawClient(config);
const handlers = createHandlers(client);

const server = new McpServer(
  { name: '@dashclaw/opencode', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

for (const toolDef of TOOL_DEFINITIONS) {
  const handler = handlers[toolDef.name];
  server.registerTool(
    toolDef.name,
    {
      description: toolDef.description,
      inputSchema: fromJsonSchema(toolDef.inputSchema),
    },
    async (args) => {
      const text = await handler(args);
      return { content: [{ type: 'text', text }] };
    },
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('@dashclaw/opencode MCP server running on stdio');
