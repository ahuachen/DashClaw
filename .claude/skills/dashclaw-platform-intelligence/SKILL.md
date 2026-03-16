---
name: dashclaw-platform-intelligence
description: >
  DashClaw platform expert (v1.9.1). Instruments agents, troubleshoots errors, scaffolds API
  routes, generates SDK clients, designs policies, and bootstraps agents. Use when the user
  mentions: DashClaw, real-time streaming, Mission Control, decision timeline, recording actions,
  policy/guard, compliance, security signals, agent pairing, SDK (dashclaw.js, client.py),
  API routes, 401/403/429/503 errors, org context, x-api-key, workspace features (handoffs,
  threads, snippets, memory, preferences), task routing, webhooks, token budgets, risk scoring,
  loops, assumptions, drift detection, or vague requests like "instrument my agent", "track decisions",
  "connect my agent", "why am I getting a 403", "set up my agent", "add monitoring".
---

# DashClaw Platform Intelligence (v1.9.1)

You are a DashClaw platform expert. You know every API route, both SDKs, the security model,
compliance frameworks, and architectural patterns. You generate code, diagnose issues, design
architectures, and orchestrate complex workflows.

## Workflow Decision Tree

Determine which workflow to follow:

**Integrating an agent with DashClaw?** --> "Instrument My Agent" below
**Error or unexpected behavior?** --> Read [references/troubleshooting.md](references/troubleshooting.md)
**Adding a new feature to DashClaw itself?** --> "Add a DashClaw Capability" below
**Generating a client in a new language?** --> "Generate Client Code" below
**Setting up policies or guard rules?** --> "Design Policies" below
**Importing an existing agent's data?** --> "Bootstrap Agent" below
**General question about the platform?** --> Read [references/platform-knowledge.md](references/platform-knowledge.md)
**Need the full API surface?** --> Read [references/api-surface.md](references/api-surface.md)

## Instrument My Agent

Full integration of DashClaw into an existing agent codebase.

### 1. Detect language, install SDK

**Node.js (v2 SDK):**
```javascript
import { DashClaw } from 'dashclaw';
const dc = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'my-agent',
});
```

**Python:**
```python
from dashclaw import DashClaw
dc = DashClaw(
    base_url=os.environ.get("DASHCLAW_BASE_URL", "http://localhost:3000"),
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="my-agent",
)
```

> **v1 Legacy SDK:** For the full 177+ method surface (SSE events, wrapClient, handoffs, context,
> messaging, pairing, etc.), import from `dashclaw/legacy` instead. See `sdk/legacy/dashclaw-v1.js`.

### 2. Identify decision points in the agent's code

Scan for: tool/API calls (actions), conditional behavior logic (policy-relevant), risk-bearing
operations (guard-worthy).

### 3. Instrument each decision point

**Guard check** (before risky operations):
```javascript
const decision = await dc.guard({
  action_type: 'file_write', content: fileContent, risk_score: 60
});
if (decision.decision === 'block') return; // blocked by policy
```

**Action recording** (wrap every significant operation):
```javascript
const { action } = await dc.createAction({
  action_type: 'api_call',
  declared_goal: 'Fetch user profile',
  risk_score: 25,
  metadata: { endpoint: '/users/123' }
});
// ... do the work ...
await dc.updateOutcome(action.action_id, {
  status: 'completed',
  output_summary: 'Profile fetched'
});
```

**Assumption tracking:**
```javascript
await dc.recordAssumption({
  action_id: action.action_id,
  assumption: 'User timezone is UTC',
  basis: 'Derived from user profile settings'
});
```

**HITL approval** (for high-risk actions):
```javascript
const { action } = await dc.createAction({
  action_type: 'infrastructure', declared_goal: 'Resize DB cluster', risk_score: 95
});
// waitForApproval polls until approved_by metadata is present
const approved = await dc.waitForApproval(action.action_id);
```

**Open loops** (track ongoing background work):
```javascript
const { loop_id } = await dc.registerOpenLoop(action.action_id, 'background_indexing', 'Indexing docs');
// ... later ...
await dc.resolveOpenLoop(loop_id, 'resolved', 'Indexed 42 files.');
```

### 4. Add env vars, validate

```bash
# .env
DASHCLAW_BASE_URL=http://localhost:3000
DASHCLAW_API_KEY=oc_live_...
```

Validate the integration:
```bash
node .claude/skills/dashclaw-platform-intelligence/scripts/validate-integration.mjs \
  --base-url http://localhost:3000 --api-key $DASHCLAW_API_KEY --full --capture-setup-proof
```

## Add a DashClaw Capability

Full-stack scaffold when adding a new API route to the DashClaw platform.

### Files to create/modify (in order)

1. **Repository** `app/lib/repositories/<domain>.repository.js` -- all SQL here
2. **Route handler** `app/api/<domain>/route.js` -- imports from repository, never inline SQL
3. **Demo fixtures** `app/lib/demo/demoFixtures.js` (if route needs demo mode)
4. **Demo middleware** handler in `middleware.js` (if route needs demo mode)
5. **Node SDK** method in `sdk/dashclaw.js` (camelCase)
6. **Python SDK** method in `sdk-python/dashclaw/client.py` (snake_case)
7. **Docs page** navItems entry + MethodEntry in `app/docs/page.js`
8. **Node README** section in `sdk/README.md`
9. **Python README** section in `sdk-python/README.md`
10. **Parity matrix** counts in `docs/sdk-parity.md`

### Route handler pattern
```javascript
import { getDbClient } from '../../lib/db.js';
import { getOrgId } from '../../lib/org.js';
import { listThings } from '../../lib/repositories/<domain>.repository.js';

export async function GET(request) {
  try {
    const sql = getDbClient();
    const orgId = getOrgId(request);
    const result = await listThings(sql, orgId, {});
    return Response.json(result);
  } catch (err) {
    console.error('[DOMAIN] GET error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Post-scaffold commands (mandatory)
```bash
npm run openapi:generate && npm run api:inventory:generate
npm run docs:check && npm run route-sql:check
npm run openapi:check && npm run api:inventory:check
npm run lint && npm run build
```

## Generate Client Code

Generate a DashClaw client in any language from the API contracts.

1. Read OpenAPI spec: `docs/openapi/critical-stable.openapi.json`
2. Read both SDKs for patterns: `sdk/dashclaw.js` (v2), `sdk-python/dashclaw/client.py`
3. Constructor (v2): `baseUrl`, `apiKey`, `agentId`
4. Auth: `x-api-key` header on every request
5. Error types: `GuardBlockedError`, `ApprovalDeniedError`
6. Minimum viable methods (v2): `guard`, `createAction`, `updateOutcome`, `recordAssumption`, `waitForApproval`

For the full 99-route API surface with method mappings, read [references/api-surface.md](references/api-surface.md).

## Design Policies

Set up behavior guard policies for agent governance.

**Guard modes:** `off` (no checks), `warn` (log but allow), `enforce` (block on policy match)

**Common patterns:**
- Cost ceiling: block when `cost_estimate > threshold`
- Risk threshold: require approval when `risk_score >= 70`
- Action type allowlist: block unknown action types
- Content filter: guard check on content before send

**Test before deploying** — use the guard endpoint with a test action:
```javascript
const result = await dc.guard({
  action_type: 'file_write',
  risk_score: 80,
  declared_goal: 'Test policy evaluation'
});
// result.decision: 'allow' | 'block' | 'require_approval'
```

## Bootstrap Agent

Import an existing agent's workspace data into DashClaw.

**Quick path:** Paste `scripts/bootstrap-prompt.md` into agent session. Agent self-scans and pushes data via the API. (`syncState()` is available in the v1 legacy SDK.)

**CLI path:**
```bash
node scripts/bootstrap-agent.mjs --dir "/path/to/agent" --agent-id "my-agent" --local --dry-run
```

**Hybrid (recommended):** CLI scanner first (files, connections, snippets), then bootstrap prompt (semantic: relationships, reasoning, observations).

Quick bootstrap wrapper:
```bash
node .claude/skills/dashclaw-platform-intelligence/scripts/bootstrap-agent-quick.mjs \
  --dir "/path/to/agent" --agent-id "my-agent" --validate
```

See `docs/agent-bootstrap.md` for the full category matrix.

## Companion Scripts

| Script | Purpose | Usage |
|---|---|---|
| `scripts/validate-integration.mjs` | Test connectivity, auth, endpoints, optional writes | `--base-url URL --api-key KEY [--full] [--json]` |
| `scripts/diagnose.mjs` | 5-phase diagnostic: connectivity, auth, endpoint, latency, errors | `--base-url URL --api-key KEY [--error "msg"] [--endpoint PATH]` |
| `scripts/bootstrap-agent-quick.mjs` | Friendly wrapper around bootstrap scanner | `--dir PATH --agent-id ID [--dry-run] [--validate]` |

## Reference Files

Read these as needed -- do not load all at once:

- **[references/platform-knowledge.md](references/platform-knowledge.md)** -- Architecture, auth chain, ID prefixes, guardrails, deployment modes
- **[references/api-surface.md](references/api-surface.md)** -- Full 98-route API with SDK method mappings across 21 categories
- **[references/troubleshooting.md](references/troubleshooting.md)** -- Error-specific diagnostic flows, common gotchas, failure patterns
