# DashClaw SDK (v2)

**Minimal governance runtime for AI agents.**

The DashClaw SDK provides the infrastructure to intercept, govern, and verify agent actions before they reach production systems.

## Installation

```bash
npm install dashclaw
```

## The Governance Loop

DashClaw v2 is designed around a single 4-step loop.

```javascript
import { DashClaw, GuardBlockedError } from 'dashclaw';

const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL,
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'my-agent'
});

async function runAgentTask() {
  // 1. GUARD: Ask for permission
  // Intercepts intent and evaluates vs. organization policies.
  const decision = await claw.guard({ 
    action_type: 'deploy', 
    risk_score: 85 
  });

  // 2. RECORD: Log the attempt
  // Promotes guarded intent into a recorded action record.
  const action = await claw.createAction({
    action_type: 'deploy',
    declared_goal: 'Deploying latest build'
  });

  try {
    // 3. VERIFY: Record assumptions
    // Tracks beliefs to detect reasoning drift later.
    await claw.recordAssumption({
      action_id: action.action_id,
      assumption: 'The staging tests passed.'
    });

    // Execute the real-world action here...
    // await deploy();

    // 4. OUTCOME: Log the evidence
    await claw.updateOutcome(action.action_id, { status: 'completed' });

  } catch (err) {
    await claw.updateOutcome(action.action_id, { status: 'failed', error: err.message });
  }
}
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

If you require legacy features (Calendar, Messages, Workflows, etc.), the v1 SDK is available via the `legacy` sub-path:

```javascript
// ESM
import { DashClaw } from 'dashclaw/legacy';

// CommonJS
const { DashClaw } = require('dashclaw/legacy');
```

*Note: Legacy features are now considered "Extensions" and require these routes to be enabled on your DashClaw server.*

---

## License
MIT
