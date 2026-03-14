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
  "signals": ["Production access", "High risk score"]
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
The **DashClaw SDK v2** is a 1:1 wrapper for this minimal API surface.

```javascript
import { DashClaw } from 'dashclaw';

const claw = new DashClaw({ baseUrl, apiKey, agentId });

// The minimal governance loop
const decision = await claw.guard({ action_type: 'deploy', risk_score: 85 });
const action = await claw.createAction({ action_type: 'deploy' });
await claw.updateOutcome(action.action_id, { status: 'completed' });
```

## Legacy Support
Legacy v1 endpoints (e.g., `/api/actions/signals`, `/api/actions/assumptions`) are automatically routed to the new runtime via server-side rewrites.
