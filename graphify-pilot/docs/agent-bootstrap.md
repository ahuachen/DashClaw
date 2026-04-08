# Agent Instrumentation (v2)

Instead of "importing" agent state, DashClaw v2 focuses on **instrumenting** agent behavior. You don't push your agent's history to DashClaw; you connect your agent's future actions to the DashClaw governance runtime.

---

## 1. Installation

Add the zero-dependency SDK to your agent project:

```bash
npm install dashclaw
# or
pip install dashclaw
```

---

## 2. Core Instrumentation (The Golden Path)

To govern an agent, you must wrap its sensitive actions in the **Governance Loop**.

### Step 1: Initialize the Client
```javascript
import { DashClaw } from 'dashclaw';

const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL,
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'my-production-agent'
});
```

### Step 2: Implement the Loop
Wrap your tool-calling or execution logic:

```javascript
async function executeRiskyAction(intent) {
  // 1. GUARD: Intercept intent
  const { decision } = await claw.guard({
    action_type: intent.type,
    risk_score: intent.estimatedRisk
  });

  // 2. RECORD: Log the start
  const action = await claw.createAction({
    action_type: intent.type,
    declared_goal: intent.goal
  });

  try {
    // Perform the action...
    const result = await myExternalSystem.call(intent);

    // 3. OUTCOME: Log success
    await claw.updateOutcome(action.action_id, { status: 'completed' });
  } catch (err) {
    // 4. OUTCOME: Log failure evidence
    await claw.updateOutcome(action.action_id, { status: 'failed', error: err.message });
  }
}
```

---

## 3. Advanced Instrumentation

### Assumption Tracking
Use `recordAssumption()` to document *why* an agent believes an action is safe. This is critical for detecting reasoning drift.

```javascript
await claw.recordAssumption({
  action_id: action.action_id,
  assumption: 'User is authenticated and has valid billing on file.'
});
```

### Human-in-the-Loop (HITL)
If `guard()` returns `require_approval`, use `waitForApproval()` to pause execution until an operator reviews the action in the DashClaw dashboard.

---

## 4. Legacy "Importing"
Feature sets related to importing memory, goals, and messaging have been moved to **Extensions**. If your workflow requires these, refer to the [Extensions Guide](architecture/capabilities.md).
