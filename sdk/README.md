# DashClaw SDK (v2.1.1)

**Minimal governance runtime for AI agents.**

The DashClaw SDK provides the infrastructure to intercept, govern, and verify agent actions before they reach production systems.

## Installation

### Node.js
```bash
npm install dashclaw
```

### Python
```bash
pip install dashclaw
```

## The Governance Loop

DashClaw v2 is designed around a single 4-step loop.

### Node.js
```javascript
import { DashClaw } from 'dashclaw';

const claw = new DashClaw({
  baseUrl: 'https://dashclaw.io',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'my-agent'
});

// 1. Ask permission
const res = await claw.guard({ action_type: 'deploy' });

// 2. Log intent
const { action_id } = await claw.createAction({ action_type: 'deploy' });

// 3. Log evidence
await claw.recordAssumption({ action_id, assumption: 'Tests passed' });

// 4. Update result
await claw.updateOutcome(action_id, { status: 'completed' });
```

### Python
```python
from dashclaw import DashClaw

claw = DashClaw(
    base_url="https://dashclaw.io",
    api_key="your_api_key",
    agent_id="my-agent"
)

# 1. Ask permission
res = claw.guard({"action_type": "deploy"})

# 2. Log intent
action = claw.create_action(action_type="deploy")
action_id = action["action_id"]

# 3. Log evidence
claw.record_assumption({"action_id": action_id, "assumption": "Tests passed"})

# 4. Update result
claw.update_outcome(action_id, status="completed")
```

---

## SDK Surface Area (v2)

The v2 SDK is optimized for stability and zero-overhead governance:

- `guard(context)` — Policy evaluation ("Can I do X?")
- `createAction(action)` — Lifecycle tracking ("I am doing X")
- `updateOutcome(id, outcome)` — Result recording ("X finished with Y")
- `recordAssumption(assumption)` — Integrity tracking ("I believe Z while doing X")
- `waitForApproval(id)` — Polling helper for human-in-the-loop approvals

---

## Error Handling

DashClaw uses standard HTTP status codes and custom error classes:

- `GuardBlockedError` — Thrown when `claw.guard()` returns a `block` decision.
- `ApprovalDeniedError` — Thrown when an operator denies an action during `waitForApproval()`.

---

## Legacy SDK (v1)

If you require legacy features (Calendar, Messages, Workflows, etc.), the v1 SDK is available via the `legacy` sub-path in Node.js or via the full client in Python.

---

## License
MIT
