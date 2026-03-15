# DashClaw SDK Reference

DashClaw provides a unified governance loop for AI agents. The SDKs (Node.js and Python) share a common core surface that maps directly to the DashClaw backend.

## The Governance Flow

**Agent &rarr; DashClaw &rarr; External Systems**

1. **Guard** (`guard`) &rarr; Check policy before acting.
2. **Action** (`createAction`) &rarr; Create an auditable record of intent.
3. **Verify** (`recordAssumption`, `registerOpenLoop`) &rarr; Log reasoning and dependencies.
4. **Approve** (`waitForApproval`) &rarr; (Optional) Pause execution for human sign-off.
5. **Outcome** (`updateOutcome`) &rarr; Finalize the evidence trail.

---

## Constructor

### Node.js
```javascript
import { DashClaw } from 'dashclaw';

const claw = new DashClaw({
  baseUrl: 'https://your-dashclaw-instance.com', // Required
  apiKey: process.env.DASHCLAW_API_KEY,          // Required
  agentId: 'my-agent'                            // Required
});
```

### Python
```python
from dashclaw.client import DashClaw

claw = DashClaw(
    base_url='https://your-dashclaw-instance.com', # Required
    api_key='your-api-key',                        # Required
    agent_id='my-agent',                           # Required
    agent_name='My Agent'                          # Optional
)
```

---

## Core Governance Methods

### `guard(context)`
Evaluates policies against an intended action before execution. Returns a decision (`allow`, `block`, or `require_approval`).

- **Node Signature:** `async guard(context)`
- **Python Signature:** `guard(self, context)`
- **Parameters:**
  - `context` (Object): Must contain details like `action_type`, `risk_score`, etc.

### `createAction(action)` / `create_action(action_type, declared_goal, **kwargs)`
Records the beginning of an action. Returns an action object with an `action_id`.

- **Node Signature:** `async createAction(action)`
- **Python Signature:** `create_action(self, action_type, declared_goal, **kwargs)`
- **Parameters (Node):** `action_type`, `declared_goal`, `risk_score`, etc.

### `waitForApproval(actionId, options)` / `wait_for_approval(action_id, timeout, interval)`
Blocks execution by polling until a human operator approves the action. If the action is denied or fails, an `ApprovalDeniedError` is thrown. Note: an action in `pending_approval` state cannot transition to running without explicit approval metadata.

- **Node Signature:** `async waitForApproval(actionId, { timeout = 300000, interval = 5000 })`
- **Python Signature:** `wait_for_approval(self, action_id, timeout=300, interval=5)`

### `updateOutcome(actionId, outcome)` / `update_outcome(action_id, status=None, **kwargs)`
Finalizes an action. Records execution metrics, success/failure status, and duration.

- **Node Signature:** `async updateOutcome(actionId, outcome)`
- **Python Signature:** `update_outcome(self, action_id, status=None, **kwargs)`

---

## Decision Integrity Methods

### `recordAssumption(assumption)` / `record_assumption(assumption)`
Records what the agent believed to be true during its decision process (useful for detecting reasoning drift).

- **Node Signature:** `async recordAssumption(assumption)`
- **Python Signature:** `record_assumption(self, assumption)`

### `registerOpenLoop(actionId, loopType, description, metadata)` / `register_open_loop(action_id, loop_type, description, **kwargs)`
Registers an unresolved dependency or uncompleted task tied to a specific action.

- **Node Signature:** `async registerOpenLoop(actionId, loopType, description, metadata = null)`
- **Python Signature:** `register_open_loop(self, action_id, loop_type, description, **kwargs)`

### `resolveOpenLoop(loopId, status, resolution)` / `resolve_open_loop(loop_id, status, resolution=None)`
Closes an open loop once the required dependency is met.

- **Node Signature:** `async resolveOpenLoop(loopId, status, resolution = null)`
- **Python Signature:** `resolve_open_loop(self, loop_id, status, resolution=None)`

---

## Operational Methods

### `heartbeat(status, metadata)` / `heartbeat(status="online", ...)`
Reports the agent's health and presence to the platform.

- **Node Signature:** `async heartbeat(status = 'online', metadata = null)`
- **Python Signature:** `heartbeat(self, status="online", current_task_id=None, metadata=None)`

### `reportConnections(connections)` / `report_connections(connections)`
Reports the external tools, APIs, and systems the agent is configured to access.

- **Node Signature:** `async reportConnections(connections)`
- **Python Signature:** `report_connections(self, connections)`

---

## Governance Intelligence Methods

### `getSignals()` / `get_signals()`
Fetches current decision integrity signals, such as autonomy spikes or reasoning drift detected across the agent fleet.

- **Node Signature:** `async getSignals()`
- **Python Signature:** `get_signals(self)`

### `getLearningVelocity(lookbackDays)` / `get_learning_velocity(agent_id=None, limit=30)`
Fetches learning velocity analytics, indicating how effectively agents are correcting execution failures over time.

- **Node Signature:** `async getLearningVelocity(lookbackDays = 30)`
- **Python Signature:** `get_learning_velocity(self, agent_id=None, limit=30)`

### `getLearningCurves(lookbackDays)` / `get_learning_curves(agent_id=None, action_type=None, limit=50)`
Fetches learning curve data.

- **Node Signature:** `async getLearningCurves(lookbackDays = 60)`
- **Python Signature:** `get_learning_curves(self, agent_id=None, action_type=None, limit=50)`

---

## Compliance + Evidence Methods

### `mapCompliance(framework)` / `map_compliance(framework)`
Maps active policies against a compliance framework's controls (e.g., SOC2, GDPR).

- **Node Signature:** `async mapCompliance(framework)`
- **Python Signature:** `map_compliance(self, framework)`

### `getProofReport(format)` / `get_proof_report(format="json")`
Generates a compliance proof report based on active policies and recorded actions.

- **Node Signature:** `async getProofReport(format = 'json')`
- **Python Signature:** `get_proof_report(self, format="json")`

---

## Activity + Audit Methods

### `getActivityLogs(filters)` / `get_activity_logs(**filters)`
Retrieves an audit log of organization activity, including policy changes, agent pair requests, and admin actions.

- **Node Signature:** `async getActivityLogs(filters = {})`
- **Python Signature:** `get_activity_logs(self, **filters)`

---

## Approvals Management (Admin / Internal)

The Python SDK includes utility methods used by the dashboard/CLI for operator actions. Note that these are primarily for admin tools.

### `get_pending_approvals(limit=20, offset=0)` (Python)
Returns a list of actions waiting for human approval.

### `approve_action(action_id, decision, reasoning=None)` (Python)
Approves or denies a pending action. Requires an API key with appropriate permissions.
