# Minimal Runtime API (v2)

DashClaw is a focused governance runtime. This API allows any agent to participate in the DashClaw governance lifecycle with zero overhead.

## The Governance Loop

Every governed decision follows this deterministic flow:

1. **Guard** (`POST /api/guard`) &rarr; "Can I do this?"
2. **Record** (`POST /api/actions`) &rarr; "I am doing this."
3. **Verify** (`POST /api/assumptions`) &rarr; "I believe this is true while I act."
4. **Outcome** (`PATCH /api/actions/:id`) &rarr; "This was the result."

---

## Core Endpoints

### 1. Guard (`POST /api/guard`)
Determines if an action is allowed based on active policies.

Risk scores are computed server-side from structured fields (`action_type`, `reversible`, `systems_touched`, `declared_goal`). The agent-supplied `risk_score` is advisory — the server uses the higher of the computed score and the agent-reported score. The response returns both `risk_score` (authoritative) and `agent_risk_score` (raw agent-supplied value, or `null`).

**Request:**
```json
{
  "action_type": "deploy",
  "declared_goal": "Deploy build #402 to production",
  "risk_score": 85,
  "agent_id": "deploy-agent-1"
}
```

**Response:**
```json
{
  "decision": "allow | block | require_approval",
  "action_id": "act_gd_...",
  "reason": "Risk score exceeds org threshold",
  "signals": ["Production access", "High risk score"],
  "risk_score": 75,
  "agent_risk_score": 0
}
```

### 2. Actions (`POST /api/actions`)
Registers the start of an action.

**Request:**
```json
{
  "action_type": "deploy",
  "declared_goal": "Deploy build #402",
  "agent_id": "deploy-agent-1"
}
```

### 3. Outcomes (`PATCH /api/actions/:id`)
Updates the result of a recorded action.

**Request:**
```json
{
  "status": "completed | failed",
  "output_summary": "Success: Build #402 is live."
}
```

### 4. Assumptions (`POST /api/assumptions`)
Records beliefs underpinning the decision. Used to detect drift.

**Request:**
```json
{
  "action_id": "act_...",
  "assumption": "The staging tests passed successfully."
}
```

---

## SDK Compatibility
The **DashClaw v2 SDK** (`dashclaw` on npm, currently 2.11.1) wraps this
minimal runtime plus a broader set of extension surfaces (Scoring, Execution
Studio, Sessions, Messaging, Handoffs, etc.) for a total of **80 methods**.
The 4 endpoints on this page are the minimum needed to participate in the
governance lifecycle — everything else is additive. See
[`sdk/README.md`](../../sdk/README.md) for the full method catalogue and
the [canonical HITL flow](../../sdk/README.md#human-in-the-loop-hitl-approval-flow).

```javascript
import { DashClaw, GuardBlockedError } from 'dashclaw';

const claw = new DashClaw({ baseUrl, apiKey, agentId });

// The minimal governance loop (with the optional approval branch)
const decision = await claw.guard({ action_type: 'deploy', risk_score: 85 });
if (decision.decision === 'block') throw new GuardBlockedError(decision);

const { action, action_id } = await claw.createAction({ action_type: 'deploy' });
if (action?.status === 'pending_approval') {
  await claw.waitForApproval(action_id);  // pass createAction's ID, not guard's
}
await claw.updateOutcome(action_id, { status: 'completed' });
```

## Legacy Support
Legacy v1 endpoints (e.g., `/api/actions/signals`, `/api/actions/assumptions`, `/api/actions/:id/approve`) are automatically routed to the new runtime via server-side rewrites configured in `next.config.js`. Both the legacy and canonical paths are live; new code should target the canonical routes.
