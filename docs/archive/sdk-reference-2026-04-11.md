---
status: archived
archived-on: 2026-04-11
archived-by: docs sync pass
superseded-by: sdk/README.md, docs/sdk-parity.md
reason: >
  This document was a second, drifting copy of the SDK method reference. It
  claimed "v2 Method Reference (45 methods)" while the canonical v2 SDK had
  grown to 80 methods across Core Governance, Scoring, Sessions, Execution
  Studio (workflow templates, model strategies, knowledge collections,
  capability runtime), and operational surfaces — none of which this file
  covered. It also omitted the HITL flow entirely. Keeping two reference
  documents in sync turned out to be impossible in practice, so this one
  was retired. The canonical reference is now sdk/README.md (served to the
  website /docs page via /api/docs/raw and the "Copy as Markdown" button)
  and the domain-level parity matrix is docs/sdk-parity.md.
---

# [ARCHIVED] DashClaw SDK Reference

> **This document is archived and is not kept in sync with the SDK source.**
>
> For the authoritative SDK surface reference, use:
>
> - **[`sdk/README.md`](../../sdk/README.md)** — full v2 method catalogue,
>   canonical HITL flow, error handling, MCP and CLI integrations, and
>   Execution Studio usage. This is the markdown served by the website
>   `/docs` page's **Copy as Markdown** button.
> - **[`docs/sdk-parity.md`](../sdk-parity.md)** — Node v2 vs Node legacy
>   vs Python domain-level parity matrix.
> - **[`PROJECT_DETAILS.md`](../../PROJECT_DETAILS.md)** — system map plus
>   the per-domain method count inventory.
>
> The content below is preserved as it existed at archive time for historical
> reference. Do not rely on any method count, signature, or example in this
> file — they were drifting at the time of archive.

---

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

> **Archive note:** The real v2 surface has 80 methods as of 2026-04-11.
> This section was never updated past the initial v2 launch. See
> `sdk/README.md` for the current complete catalogue.

### Core Governance (7 methods)

#### `guard(context)`
Evaluates policies against an intended action before execution. Returns a decision (`allow`, `block`, or `require_approval`).

#### `createAction(action)` / `create_action(action_type, declared_goal, **kwargs)`
Records the beginning of an action. Returns an action object with an `action_id`.

#### `waitForApproval(actionId, options)` / `wait_for_approval(action_id, timeout, interval)`
Blocks execution by polling until a human operator approves the action.

#### `approveAction(actionId, decision, reasoning?)` / `approve_action(action_id, decision, reasoning=None)`
Approves or denies a pending action.

#### `getPendingApprovals()` / `get_pending_approvals(limit=20, offset=0)`
Returns a list of actions waiting for human approval.

#### `updateOutcome(actionId, outcome)` / `update_outcome(action_id, status=None, **kwargs)`
Finalizes an action.

#### `recordAssumption(assumption)` / `record_assumption(assumption)`
Records what the agent believed to be true during its decision process.

### Decision Integrity (3 methods)

`registerOpenLoop`, `resolveOpenLoop`, `getSignals`

### Operational (2 methods)

`heartbeat`, `reportConnections`

### Learning & Optimization (4 methods)

`getLearningVelocity`, `getLearningCurves`, `getLessons`, `renderPrompt`

### Scoring Profiles (17 methods)

`createScorer`, `createScoringProfile`, `listScoringProfiles`,
`getScoringProfile`, `updateScoringProfile`, `deleteScoringProfile`,
`addScoringDimension`, `updateScoringDimension`, `deleteScoringDimension`,
`scoreWithProfile`, `batchScoreWithProfile`, `getProfileScores`,
`getProfileScoreStats`, `createRiskTemplate`, `listRiskTemplates`,
`updateRiskTemplate`, `deleteRiskTemplate`, `autoCalibrate`

### Messaging (2 methods)

`sendMessage`, `getInbox`

### Handoffs (2 methods)

`createHandoff`, `getLatestHandoff`

### Security Scanning (1 method)

`scanPromptInjection`

### Feedback (1 method)

`submitFeedback`

### Context Threads (3 methods)

`createThread`, `addThreadEntry`, `closeThread`

### Bulk Sync (1 method)

`syncState`

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
