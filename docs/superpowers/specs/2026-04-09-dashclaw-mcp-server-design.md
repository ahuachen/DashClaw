# DashClaw MCP Server Design Spec

**Date:** 2026-04-09
**Status:** Draft
**Author:** Wes + Claude

## Overview

Build a DashClaw MCP server that exposes the governance API (guard, record, invoke, discovery, approvals, sessions) as MCP tools and resources. This enables any MCP-compatible client — Claude Managed Agents, Claude Code, Claude Desktop — to plug into DashClaw governance with a single config line instead of writing HTTP boilerplate.

### Why

The existing `examples/managed-agent-governed/` example works but requires ~410 lines of custom tool definitions, HTTP clients, and result routing. With MCP, the same integration is ~80 lines: create agent with `mcp_servers` config, stream events, done. MCP is the standard protocol for tool providers in the Claude ecosystem — DashClaw should speak it natively.

### What This Is NOT

This is not an agent framework feature. The MCP server is a governance client — it helps agents ask "should I do this?" and "record what I did." It falls squarely within DashClaw's category boundary: Decision Infrastructure, not Agent Platform.

## Architecture

### Package Structure

```
mcp-server/
├── package.json            # @dashclaw/mcp-server
├── README.md
├── .env.example
├── bin/
│   └── dashclaw-mcp.js     # CLI entry point (stdio transport)
└── lib/
    ├── client.js            # HTTP client for DashClaw API
    ├── tools.js             # 8 tool definitions + handlers
    ├── resources.js         # 4 resource definitions + handlers
    └── server.js            # MCP server factory

app/api/mcp/
└── route.js                 # SSE transport (Next.js API route)
```

### Transport Strategy

Two transports, same server:

1. **stdio** (`@dashclaw/mcp-server` npm package) — For Claude Code, Claude Desktop, and local MCP clients. Run via `npx @dashclaw/mcp-server` or add to `claude_desktop_config.json`.

2. **SSE** (`/api/mcp` Next.js route) — For Claude Managed Agents and remote MCP clients. Deploying DashClaw automatically exposes the MCP endpoint. No extra infrastructure.

Both transports import the same server factory from `mcp-server/lib/server.js`. The factory creates a configured `McpServer` instance with all tools and resources registered. Each transport connects its own I/O layer.

### Dependency

Single dependency: `@modelcontextprotocol/sdk`. The HTTP client uses native `fetch` (Node 18+).

## Authentication & Configuration

### Resolution Order (highest to lowest priority)

1. Constructor args (passed from MCP server config or SSE route)
2. Environment variables
3. Defaults

### Configuration Values

| Config | Env Var | Default | Description |
|---|---|---|---|
| `url` | `DASHCLAW_URL` | `http://localhost:3000` | DashClaw instance URL |
| `apiKey` | `DASHCLAW_API_KEY` | (empty) | API key (prefix: `oc_live_`) |
| `agentId` | `DASHCLAW_AGENT_ID` | (empty) | Default agent ID for all tool calls. If neither config nor env var is set, each tool call must provide `agent_id` explicitly or the API will use an empty string. |

### HTTP Client (`lib/client.js`)

Thin wrapper around native `fetch`:
- Sets `Content-Type: application/json` and `x-api-key` header on all requests.
- 10s timeout for reads (guard, list, status), 30s for writes (invoke, record).
- Returns structured `{ error, status }` on failure. No swallowed errors.
- No retry logic — retries belong at a higher layer.

### stdio Usage

```bash
# Via env vars
DASHCLAW_URL=https://my-instance.vercel.app DASHCLAW_API_KEY=oc_live_xxx npx @dashclaw/mcp-server

# Via CLI args
npx @dashclaw/mcp-server --url https://my-instance.vercel.app --key oc_live_xxx

# Claude Desktop config
{
  "mcpServers": {
    "dashclaw": {
      "command": "npx",
      "args": ["@dashclaw/mcp-server"],
      "env": {
        "DASHCLAW_URL": "https://my-instance.vercel.app",
        "DASHCLAW_API_KEY": "oc_live_xxx"
      }
    }
  }
}
```

### SSE Usage (Managed Agents)

```python
agent = client.beta.agents.create(
    name="Governed Agent",
    model="claude-sonnet-4-6",
    tools=[{"type": "agent_toolset_20260401"}],
    mcp_servers=[{
        "type": "url",
        "url": "https://my-dashclaw.vercel.app/api/mcp",
        "headers": {"x-api-key": "oc_live_xxx"},
        "name": "dashclaw"
    }],
)
```

The `/api/mcp` route is protected by DashClaw's existing middleware (same `x-api-key` validation as all other routes).

## Tools (8)

### Core Governance

#### `dashclaw_guard`

Evaluate DashClaw governance policies before taking a risky action. Call this BEFORE any action that modifies external systems, deploys code, sends messages, or touches production data. Returns a decision: `allow` (proceed), `warn` (proceed with caution), `block` (stop), or `require_approval` (wait for human). If blocked, do NOT proceed.

**Calls:** `POST /api/guard`

**Input:**
```json
{
  "action_type": "string (required) — Category: deploy, send_email, database_write, api_call, etc.",
  "declared_goal": "string (required) — What you intend to do, in plain language",
  "risk_score": "integer 0-100 (required) — Estimated risk. Use 70+ for production systems.",
  "agent_id": "string (optional) — Override default agent ID",
  "systems_touched": ["string array (optional) — Systems affected: production, database, email, etc."],
  "reversible": "boolean (optional, default true) — Whether the action can be undone"
}
```

**Output:**
```json
{
  "decision": "allow | warn | block | require_approval",
  "reason": "string — Why this decision was made",
  "matched_policies": ["policy IDs that triggered"],
  "risk_level": "string"
}
```

#### `dashclaw_record`

Record a governed action in DashClaw's audit trail. Use this to log significant decisions, completed tasks, or notable outcomes. Every important action should be recorded for governance and compliance visibility in Mission Control.

**Calls:** `POST /api/actions`

**Input:**
```json
{
  "action_type": "string (required) — Category: research, analysis, code_change, deploy, etc.",
  "declared_goal": "string (required) — What was accomplished",
  "status": "string (required) — running | completed | failed | pending_approval",
  "risk_score": "integer 0-100 (optional, default 30)",
  "agent_id": "string (optional) — Override default agent ID",
  "reasoning": "string (optional) — Why this action was chosen",
  "confidence": "integer 0-100 (optional) — Confidence in the action",
  "systems_touched": ["string array (optional)"],
  "reversible": "boolean (optional)",
  "output_summary": "string (optional) — Brief summary of what was produced",
  "tokens_in": "integer (optional) — Input tokens consumed",
  "tokens_out": "integer (optional) — Output tokens produced",
  "model": "string (optional) — Model used",
  "cost_estimate": "number (optional) — Estimated cost in USD"
}
```

**Output:**
```json
{
  "action": { "id": "...", "action_id": "act_...", "status": "...", "..." : "..." },
  "action_id": "act_...",
  "decision": { "decision": "allow | warn | block | require_approval", "..." : "..." },
  "security": { "clean": true, "findings_count": 0, "..." : "..." }
}
```

#### `dashclaw_invoke`

Invoke a DashClaw-governed capability (external API). The capability is guarded (policy check), executed (HTTP call), and recorded (audit trail) automatically. Use this instead of making direct HTTP calls when the target API is registered as a DashClaw capability.

**Calls:** `POST /api/capabilities/{capability_id}/invoke`

**Input:**
```json
{
  "capability_id": "string (required) — The capability ID (e.g., cap_abc123)",
  "declared_goal": "string (required) — What you're trying to accomplish",
  "agent_id": "string (optional) — Override default agent ID",
  "payload": "object (optional) — Request payload for the capability"
}
```

**Output:**
```json
{
  "success": true,
  "action_id": "act_...",
  "result": "any — The capability's response",
  "elapsed_ms": 123,
  "governed": true
}
```

On failure (blocked, pending approval, circuit breaker):
```json
{
  "success": false,
  "error": "blocked_by_policy | pending_approval | quota_exceeded | circuit_breaker_open | access_denied",
  "action_id": "act_...",
  "message": "string"
}
```

### Discovery

#### `dashclaw_capabilities_list`

List available capabilities registered in DashClaw. Use this to discover what external APIs and tools are available before invoking them. Returns capability IDs, names, health status, and risk levels.

**Calls:** `GET /api/capabilities`

**Input:**
```json
{
  "category": "string (optional) — Filter by category: external_api, webhook, function",
  "risk_level": "string (optional) — Filter: low, medium, high, critical",
  "search": "string (optional) — Search by name or description"
}
```

**Output:**
```json
{
  "capabilities": [
    {
      "id": "cap_...",
      "name": "string",
      "description": "string",
      "category": "string",
      "risk_level": "low | medium | high | critical",
      "health_status": "healthy | degraded | failing",
      "requires_approval": false
    }
  ]
}
```

#### `dashclaw_policies_list`

List active governance policies. Use this to understand what rules govern your actions before taking them. Helps you calibrate risk scores and know which action types require approval.

**Calls:** `GET /api/policies`

**Input:**
```json
{
  "agent_id": "string (optional) — Filter to policies applying to a specific agent"
}
```

**Output:**
```json
{
  "policies": [
    {
      "id": "gp_...",
      "name": "string",
      "policy_type": "string",
      "rules": "string (JSON)",
      "active": 1,
      "agent_ids": "string (JSON array) or null (null = all agents)"
    }
  ]
}
```

### Approval Flow

#### `dashclaw_wait_for_approval`

Wait for a human to approve or deny a pending action in DashClaw's Mission Control. Call this after a guard decision returns `require_approval` or after recording an action with `status: pending_approval`. Polls the action status until it changes from `pending_approval` to `completed` (approved) or `failed` (denied).

**Calls:** `GET /api/actions/{action_id}` (polling at 3s intervals, 5min timeout)

**Input:**
```json
{
  "action_id": "string (required) — The action ID to wait on (e.g., act_abc123)",
  "timeout_seconds": "integer (optional, default 300) — Max wait time before giving up",
  "poll_interval_seconds": "integer (optional, default 3) — Polling frequency"
}
```

**Output:**
```json
{
  "approved": true,
  "action": { "id": "...", "status": "completed | failed", "..." : "..." },
  "waited_seconds": 45
}
```

On timeout:
```json
{
  "approved": false,
  "timed_out": true,
  "action": { "status": "pending_approval" },
  "waited_seconds": 300
}
```

### Session Lifecycle

#### `dashclaw_session_start`

Register this agent session with DashClaw. Creates a session record that groups all subsequent actions for tracking and observability. Call this at the beginning of a task.

**Calls:** `POST /api/sessions`

**Input:**
```json
{
  "agent_id": "string (required) — Agent identifier",
  "workspace": "string (optional) — Workspace or project context",
  "branch": "string (optional) — Git branch or task branch"
}
```

**Output:**
```json
{
  "session": {
    "id": "string",
    "agent_id": "string",
    "status": "string",
    "created_at": "ISO-8601"
  }
}
```

#### `dashclaw_session_end`

Close a DashClaw session and update its status. Call this when the task is complete or if the session needs to be marked as failed. Provides a clean lifecycle boundary for governance reporting.

**Calls:** `PATCH /api/sessions/{session_id}`

**Input:**
```json
{
  "session_id": "string (required) — The session ID from dashclaw_session_start",
  "status": "string (required) — completed | failed | cancelled",
  "summary": "string (optional) — Brief description of what was accomplished"
}
```

**Output:**
```json
{
  "session": {
    "id": "string",
    "status": "completed",
    "updated_at": "ISO-8601"
  }
}
```

## Resources (4)

MCP resources provide read-only governance context. Agents can read these without triggering tool calls.

### `dashclaw://policies`

Current active policy set for the organization.

**Calls:** `GET /api/policies`

**Returns:** Array of policy objects with name, type, rules, active status, and agent scope.

### `dashclaw://capabilities`

Available capabilities and their health status.

**Calls:** `GET /api/capabilities`

**Returns:** Array of capability objects with id, name, description, category, risk level, health status, and approval requirements.

### `dashclaw://agent/{agent_id}/history`

Recent action history for a specific agent. URI template — agent ID is substituted at read time.

**Calls:** `GET /api/actions?agent_id={agent_id}&limit=50`

**Returns:** Last 50 action records with type, goal, status, risk score, and timestamp.

### `dashclaw://status`

DashClaw instance health and operational summary.

**Calls:** `GET /api/health` + `GET /api/operations/summary`

**Returns:** Combined object with:
- Instance health (database, runtime, realtime backend status)
- Operational metrics (throughput, latency, approval backlog, workflow health, capability health)

## SSE Transport Route (`app/api/mcp/route.js`)

The route exposes the MCP server over HTTP using the MCP SDK's SSE transport adapter.

**Endpoints:**
- `GET /api/mcp` — Opens SSE stream, returns session endpoint URL
- `POST /api/mcp` — Receives JSON-RPC messages for the session

**Authentication:** Same `x-api-key` middleware as all DashClaw routes. No additional auth layer.

**Implementation:** Imports `createServer()` from `mcp-server/lib/server.js`, connects SSE transport. The route reads `x-api-key` from the request (already validated by middleware), passes it to the server factory as the `apiKey` config value, and sets `url` to the app's own origin (`http://localhost:3000` in dev, the Vercel URL in production). This means the MCP tools call back into the same DashClaw instance's REST API, authenticated with the caller's key, ensuring org-scoping is preserved.

## Updated Managed Agent Example

New directory: `examples/managed-agent-mcp/`

This replaces `examples/managed-agent-governed/` as the **recommended** integration path. The original custom-tools example stays as a reference.

**Key difference:** ~80 lines vs ~410 lines. No custom tool definitions, no HTTP client code, no tool result routing. The agent gets governance tools automatically via MCP.

**Structure:**
```
examples/managed-agent-mcp/
├── main.py
├── requirements.txt    # anthropic, python-dotenv (no requests needed)
├── .env.example        # ANTHROPIC_API_KEY, DASHCLAW_URL, DASHCLAW_API_KEY
└── README.md
```

**Flow:**
1. Create agent with `mcp_servers` pointing at DashClaw SSE endpoint
2. Create environment with `limited` networking allowing DashClaw host + MCP servers
3. Start session and stream events
4. No custom tool handling — MCP tools are executed server-side by the MCP protocol

## Package Publishing

Published as `@dashclaw/mcp-server` on npm. Same monorepo pattern as `sdk/` (published as `dashclaw`).

```json
{
  "name": "@dashclaw/mcp-server",
  "version": "1.0.0",
  "bin": { "dashclaw-mcp": "./bin/dashclaw-mcp.js" },
  "dependencies": { "@modelcontextprotocol/sdk": "^1.x" },
  "engines": { "node": ">=18.0.0" }
}
```

## Documentation Updates Required

Per the SDK Documentation Checklist:
1. `app/docs/page.js` — Add MCP Server section
2. `sdk/README.md` — Add MCP integration section
3. `sdk-python/README.md` — Reference MCP as alternative integration
4. `docs/sdk-parity.md` — Add MCP server column
5. `docs/api-inventory.md` — Add `/api/mcp` route
6. `PROJECT_DETAILS.md` — Add MCP server to architecture section
7. `CHANGELOG.md` — Add to next release
8. `ROADMAP.md` — Move from "Exploring" to "In Progress" or "Shipped"
9. `examples/README.md` — Add MCP example, mark as recommended
10. `README.md` — Update "Works With" section

## Out of Scope (Future Work)

- **DashClaw Skill for Managed Agents** — Progressive disclosure of governance context. Natural follow-on after the MCP server ships.
- **Session Observer** — DashClaw watches Managed Agent sessions via the events API and records to Mission Control automatically. Requires Anthropic API key with session read permissions.
- **MCP Resources for workflow state** — Expose workflow templates, run history, artifacts as MCP resources.
- **MCP Prompts** — Pre-built governance prompt templates (e.g., "run a governed research task").
