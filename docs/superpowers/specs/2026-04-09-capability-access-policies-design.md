# Capability Access Policies Design Spec

Date: 2026-04-09
Status: Approved
Roadmap: Trust & Permissions — Wave A

## Goal

Add per-agent access control to capabilities so operators can restrict which agents can invoke which capabilities, with deny, allow, and require_approval access levels.

## Problem

Capability access is currently org-wide. Any agent in the org can invoke any capability. Enterprises need to restrict which agents can call production APIs, enforce approval for high-risk capabilities, and deny access to agents that shouldn't touch certain systems.

## Approach

One new `capability_access_rules` table with simple agent+capability→access rules. Evaluation in the invoke route before execution. CRUD routes and a UI tab on the capability detail page. No complex RBAC — just direct rules with clear precedence.

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS capability_access_rules (
  id SERIAL PRIMARY KEY,
  rule_id TEXT UNIQUE NOT NULL,
  org_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  agent_id TEXT,
  access TEXT NOT NULL,
  reason TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Column Notes

- `capability_id`: references capabilities table
- `agent_id`: the agent this rule applies to. NULL = org-wide default for this capability.
- `access`: one of `allow`, `deny`, `require_approval`
- `reason`: human-readable explanation (e.g., "Production API — restricted to deploy-bot only")
- `created_by`: operator who created the rule (from request headers or API key)

### Evaluation Precedence

1. Agent-specific rule (`capability_id + agent_id` match) — highest priority
2. Org-wide default (`capability_id + agent_id IS NULL`) — fallback
3. No rule exists — allow (preserves current open behavior)

This means: if an agent has a specific `allow` rule but the org-wide default is `deny`, the agent is allowed. Agent-specific rules always win.

## Repository

`app/lib/repositories/capability-access.repository.js`

### evaluateAccess(sql, orgId, capabilityId, agentId)

The core function. Returns `{ access: 'allow'|'deny'|'require_approval', rule: {...}|null }`.

1. Query for agent-specific rule: `WHERE capability_id = ? AND agent_id = ?`
2. If found, return it
3. Query for org-wide default: `WHERE capability_id = ? AND agent_id IS NULL`
4. If found, return it
5. Return `{ access: 'allow', rule: null }` (no rule = open)

Can be done in a single query with ORDER BY (agent_id IS NULL) to get agent-specific first.

### createAccessRule(sql, orgId, data)

Creates a rule. Generates `car_` prefixed ID. Validates that `access` is one of the three valid values.

### listAccessRules(sql, orgId, capabilityId)

Returns all rules for a capability, ordered by: agent-specific first (agent_id NOT NULL), then org-wide defaults.

### deleteAccessRule(sql, orgId, ruleId)

Hard delete. Returns `{ deleted: true }` or null.

## Integration: Capability Invoke Route

In `app/api/capabilities/[capabilityId]/invoke/route.js`, after guard evaluation and quota check, before execution:

```javascript
const accessResult = await evaluateAccess(sql, orgId, capabilityId, agentId);

if (accessResult.access === 'deny') {
  return NextResponse.json({
    success: false,
    error: 'access_denied',
    code: 'CAPABILITY_ACCESS_DENIED',
    reason: accessResult.rule?.reason || 'Agent does not have access to this capability.',
    capability_id: capabilityId,
    agent_id: agentId,
  }, { status: 403 });
}

if (accessResult.access === 'require_approval') {
  // Create a pending_approval action record and return 202
  // Same pattern as guard-blocked-with-approval
}
```

The `require_approval` path reuses the existing pending_approval flow — creates an action_record with `status='pending_approval'` and returns 202 with the action_id for the caller to poll.

## API Routes

### `GET /api/capabilities/[capabilityId]/access`

List all access rules for a capability. Returns `{ rules: [...] }`.

### `POST /api/capabilities/[capabilityId]/access`

Create a new access rule. Body: `{ agent_id?, access, reason? }`.

Validation:
- `access` must be `allow`, `deny`, or `require_approval`
- If `agent_id` is provided, it should be a non-empty string
- Duplicate rules (same capability_id + agent_id) are rejected

### `DELETE /api/capabilities/[capabilityId]/access/[ruleId]`

Delete an access rule.

### `GET /api/capabilities/[capabilityId]/access/check`

Check access for a specific agent. Query param: `agent_id`. Returns `{ access, rule }`.

## UI

### Capability Detail Page — Access Tab

Add an "Access" tab to the existing capability detail page at `app/capabilities/[capabilityId]/page.jsx`.

The tab shows:
- Summary: "2 rules configured" or "No access rules — all agents can invoke this capability"
- Rule list: each rule shows agent_id (or "All agents" for org-wide), access level pill (green allow, red deny, amber require_approval), reason, delete button
- Add rule form: agent ID input, access level dropdown, reason textarea, save button

### Access Level Pills

- `allow` — green pill
- `deny` — red pill
- `require_approval` — amber pill

## Testing

### `__tests__/unit/capability-access.repository.test.js`

- `evaluateAccess` returns allow when no rules exist
- `evaluateAccess` returns agent-specific rule over org-wide default
- `evaluateAccess` returns org-wide default when no agent-specific rule
- `evaluateAccess` returns deny for denied agent
- `evaluateAccess` returns require_approval when configured
- `shapeAccessRule` parses correctly
- `shapeAccessRule` handles null

### Integration test expectations

- Denied agent gets 403 on invoke
- Allowed agent passes through
- require_approval agent gets 202 with pending action

## Scope Boundaries

### In scope
- `capability_access_rules` table
- Repository with evaluate, CRUD
- Invoke route integration (deny → 403, require_approval → 202)
- 4 API routes (list, create, delete, check)
- Access tab on capability detail page
- Tests for evaluate logic

### Out of scope
- Agent groups (Wave B)
- Delegation tokens (Wave C)
- Capability access inheritance from groups
- Wildcard rules (e.g., "deny all capabilities for this agent")
- Time-based access rules (e.g., "allow only during business hours")
- Access rules for workflow execution or knowledge collections (capabilities only for V1)
