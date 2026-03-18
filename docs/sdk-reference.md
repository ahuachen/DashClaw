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
    agent_name='My Agent'                          # Optional (Python full SDK only)
)
```

---

## v2 Method Reference (45 methods)

### Core Governance (7 methods)

#### `guard(context)`
Evaluates policies against an intended action before execution. Returns a decision (`allow`, `block`, or `require_approval`).

Risk scores are computed server-side from structured fields (`action_type`, `reversible`, `systems_touched`, `declared_goal`). The agent-supplied `risk_score` is advisory — the server uses the higher of the computed score and the agent-reported score. The response includes `risk_score` (authoritative server-computed score) and `agent_risk_score` (raw agent-supplied value, or `null`).

- **Node Signature:** `async guard(context)`
- **Python Signature:** `guard(self, context)`
- **Parameters:**
  - `context` (Object): Must contain details like `action_type`, `risk_score`, etc.

#### `createAction(action)` / `create_action(action_type, declared_goal, **kwargs)`
Records the beginning of an action. Returns an action object with an `action_id`.

- **Node Signature:** `async createAction(action)`
- **Python Signature:** `create_action(self, action_type, declared_goal, **kwargs)`
- **Parameters (Node):** `action_type`, `declared_goal`, `risk_score`, etc.

#### `waitForApproval(actionId, options)` / `wait_for_approval(action_id, timeout, interval)`
Blocks execution by polling until a human operator approves the action. If the action is denied or fails, an `ApprovalDeniedError` is thrown. Note: an action in `pending_approval` state cannot transition to running without explicit approval metadata.

- **Node Signature:** `async waitForApproval(actionId, { timeout = 300000, interval = 5000 })`
- **Python Signature:** `wait_for_approval(self, action_id, timeout=300, interval=5)`

#### `approveAction(actionId, decision, reasoning?)` / `approve_action(action_id, decision, reasoning=None)`
Approves or denies a pending action. Requires an API key with appropriate permissions.

- **Node Signature:** `async approveAction(actionId, decision, reasoning = null)`
- **Python Signature:** `approve_action(self, action_id, decision, reasoning=None)`

#### `getPendingApprovals()` / `get_pending_approvals(limit=20, offset=0)`
Returns a list of actions waiting for human approval.

- **Node Signature:** `async getPendingApprovals()`
- **Python Signature:** `get_pending_approvals(self, limit=20, offset=0)`

#### `updateOutcome(actionId, outcome)` / `update_outcome(action_id, status=None, **kwargs)`
Finalizes an action. Records execution metrics, success/failure status, and duration.

- **Node Signature:** `async updateOutcome(actionId, outcome)`
- **Python Signature:** `update_outcome(self, action_id, status=None, **kwargs)`

#### `recordAssumption(assumption)` / `record_assumption(assumption)`
Records what the agent believed to be true during its decision process (useful for detecting reasoning drift).

- **Node Signature:** `async recordAssumption(assumption)`
- **Python Signature:** `record_assumption(self, assumption)`

---

### Decision Integrity (3 methods)

#### `registerOpenLoop(actionId, loopType, description, metadata)` / `register_open_loop(action_id, loop_type, description, **kwargs)`
Registers an unresolved dependency or uncompleted task tied to a specific action.

- **Node Signature:** `async registerOpenLoop(actionId, loopType, description, metadata = null)`
- **Python Signature:** `register_open_loop(self, action_id, loop_type, description, **kwargs)`

#### `resolveOpenLoop(loopId, status, resolution)` / `resolve_open_loop(loop_id, status, resolution=None)`
Closes an open loop once the required dependency is met.

- **Node Signature:** `async resolveOpenLoop(loopId, status, resolution = null)`
- **Python Signature:** `resolve_open_loop(self, loop_id, status, resolution=None)`

#### `getSignals()` / `get_signals()`
Fetches current decision integrity signals, such as autonomy spikes or reasoning drift detected across the agent fleet.

- **Node Signature:** `async getSignals()`
- **Python Signature:** `get_signals(self)`

---

### Operational (2 methods)

#### `heartbeat(status, metadata)` / `heartbeat(status="online", ...)`
Reports the agent's health and presence to the platform.

- **Node Signature:** `async heartbeat(status = 'online', metadata = null)`
- **Python Signature:** `heartbeat(self, status="online", current_task_id=None, metadata=None)`

#### `reportConnections(connections)` / `report_connections(connections)`
Reports the external tools, APIs, and systems the agent is configured to access.

- **Node Signature:** `async reportConnections(connections)`
- **Python Signature:** `report_connections(self, connections)`

---

### Learning & Optimization (4 methods)

#### `getLearningVelocity(lookbackDays)` / `get_learning_velocity(agent_id=None, limit=30)`
Fetches learning velocity analytics, indicating how effectively agents are correcting execution failures over time.

- **Node Signature:** `async getLearningVelocity(lookbackDays = 30)`
- **Python Signature:** `get_learning_velocity(self, agent_id=None, limit=30)`

#### `getLearningCurves(lookbackDays)` / `get_learning_curves(agent_id=None, action_type=None, limit=50)`
Fetches learning curve data.

- **Node Signature:** `async getLearningCurves(lookbackDays = 60)`
- **Python Signature:** `get_learning_curves(self, agent_id=None, action_type=None, limit=50)`

#### `getLessons({ actionType, limit })` / `get_lessons(action_type=..., limit=...)`
Fetches consolidated lessons from scored outcomes — what DashClaw has learned about this agent's performance patterns.

- **Node Signature:** `async getLessons({ actionType, limit })`
- **Python Signature:** `get_lessons(self, action_type=None, limit=10)`
- **Endpoint:** `GET /api/learning/lessons`
- **Parameters:**
  - `actionType` / `action_type` (string, optional): Filter by action type
  - `limit` (number, optional): Max lessons to return (default 10)
- **Returns:** `{ lessons: Object[], drift_warnings: Object[], agent_id: string }`

Each lesson includes: `action_type`, `confidence`, `success_rate`, `hints` (`risk_cap`, `prefer_reversible`, `confidence_floor`, `expected_duration`, `expected_cost`), `guidance`, `sample_size`.

#### `renderPrompt(context)`
Fetches rendered prompt templates from DashClaw.

- **Node Signature:** `async renderPrompt(context)`

---

### Scoring Profiles (17 methods)

#### `createScorer(name, type, config)`
Define automated evaluations.

- **Node Signature:** `async createScorer(name, type, config)`

#### `createScoringProfile(profile)`
Create a weighted multi-dimensional scoring profile.

#### `listScoringProfiles(filters)`
List all scoring profiles.

#### `getScoringProfile(profileId)`
Get a profile with its dimensions.

#### `updateScoringProfile(profileId, updates)`
Update profile metadata or composite method.

#### `deleteScoringProfile(profileId)`
Delete a scoring profile.

#### `addScoringDimension(profileId, dimension)`
Add a dimension to a profile.

#### `updateScoringDimension(profileId, dimensionId, updates)`
Update a dimension's scale or weight.

#### `deleteScoringDimension(profileId, dimensionId)`
Remove a dimension from a profile.

#### `scoreWithProfile(profileId, action)`
Score a single action; returns composite + per-dimension breakdown.

#### `batchScoreWithProfile(profileId, actions)`
Score multiple actions; returns results + summary stats.

#### `getProfileScores(filters)`
List stored profile scores (filter by profile_id, agent_id, action_id).

#### `getProfileScoreStats(profileId)`
Aggregate stats: avg, min, max, stddev for a profile.

#### `createRiskTemplate(template)`
Define rules for automatic risk score computation.

#### `listRiskTemplates(filters)`
List all risk templates.

#### `updateRiskTemplate(templateId, updates)`
Update a risk template's rules or base_risk.

#### `deleteRiskTemplate(templateId)`
Delete a risk template.

#### `autoCalibrate(options)`
Analyze historical actions and suggest percentile-based scoring scales.

---

### Messaging (2 methods)

#### `sendMessage({ to, type, subject, body, threadId, urgent })`
Sends a message to another agent or broadcasts to all agents.

- **Node Signature:** `async sendMessage({ to, type, subject, body, threadId, urgent })`
- **Endpoint:** `POST /api/messages`

#### `getInbox({ type, unread, limit })`
Retrieves inbox messages with optional filters.

- **Node Signature:** `async getInbox({ type, unread, limit })`
- **Endpoint:** `GET /api/messages`

---

### Handoffs (2 methods)

#### `createHandoff(handoff)`
Creates a session handoff with context for the next agent or session.

- **Node Signature:** `async createHandoff(handoff)`
- **Endpoint:** `POST /api/handoffs`

#### `getLatestHandoff()`
Retrieves the most recent handoff for this agent.

- **Node Signature:** `async getLatestHandoff()`
- **Endpoint:** `GET /api/handoffs?latest=true`

---

### Security Scanning (1 method)

#### `scanPromptInjection(text, { source })`
Scans text for prompt injection attacks. Returns risk level and recommendation.

- **Node Signature:** `async scanPromptInjection(text, { source })`
- **Endpoint:** `POST /api/security/prompt-injection`

---

### Feedback (1 method)

#### `submitFeedback({ action_id, rating, comment, category, tags, metadata })`
Submits feedback on a completed action.

- **Node Signature:** `async submitFeedback({ action_id, rating, comment, category, tags, metadata })`
- **Endpoint:** `POST /api/feedback`

---

### Context Threads (3 methods)

#### `createThread(thread)`
Creates a context thread for tracking multi-step work.

- **Node Signature:** `async createThread(thread)`
- **Endpoint:** `POST /api/context/threads`

#### `addThreadEntry(threadId, content, entryType)`
Adds an entry to a context thread.

- **Node Signature:** `async addThreadEntry(threadId, content, entryType)`
- **Endpoint:** `POST /api/context/threads/:id/entries`

#### `closeThread(threadId, summary)`
Closes a context thread with an optional summary.

- **Node Signature:** `async closeThread(threadId, summary)`
- **Endpoint:** `PATCH /api/context/threads/:id`

---

### Bulk Sync (1 method)

#### `syncState(state)`
Pushes a full agent state snapshot in a single call.

- **Node Signature:** `async syncState(state)`
- **Endpoint:** `POST /api/sync`

---

## v1 Legacy Methods

The following methods have been moved to v1 only and are not available in the v2 SDK:

- `createWebhook(url, events)` -- Admin webhook configuration
- `getActivityLogs(filters)` -- Operator audit log browsing
- `mapCompliance(framework)` -- Quarterly compliance mapping
- `getProofReport(format)` -- Auditor reporting

Access these via the legacy import path:

```javascript
import { DashClaw } from 'dashclaw/legacy';
```
