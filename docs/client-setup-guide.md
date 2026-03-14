# DashClaw: Setup & Usage Guide

> **What is DashClaw?** DashClaw is a **policy firewall** for AI agents. It sits between AI agents and real-world systems to intercept actions, enforce policies, and record decision evidence before execution.
>
> **Live Demo:** https://dashclaw.io/demo
> **npm Package:** `dashclaw`

---

## 1. Quick Start (The 5-Minute Path)

### Step 1: Deploy DashClaw
The fastest path is **Vercel + Neon**.
1. Create a free database at [neon.tech](https://neon.tech).
2. Fork the DashClaw repo.
3. Import to Vercel and set `DATABASE_URL`.

### Step 2: Verify the Instance
Open `YOUR_BASE_URL/setup` to verify your instance is healthy and ready for traffic.

### Step 3: Connect Your First Agent
Open `YOUR_BASE_URL/connect`. This page provides the "Golden Path" for connecting a real agent, including copy-paste snippets for Node and Python.

---

## 2. The Minimal Governance Loop

DashClaw v2 is built around a single 4-step lifecycle:

1. **Guard** &rarr; `claw.guard()` checks intent against your organization's policies.
2. **Record** &rarr; `claw.createAction()` logs the start of the action.
3. **Verify** &rarr; `claw.recordAssumption()` tracks the reasoning basis to detect drift.
4. **Outcome** &rarr; `claw.updateOutcome()` records the final evidence.

---

## 3. SDK Integration (v2)

### Node.js (ESM)

```javascript
import { DashClaw, GuardBlockedError } from 'dashclaw';

const claw = new DashClaw({
  baseUrl: 'https://your-dashclaw.com',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'my-agent',
});

// Full Governance Cycle
const decision = await claw.guard({ action_type: 'deploy', risk_score: 85 });
const action = await claw.createAction({ action_type: 'deploy' });
await claw.updateOutcome(action.action_id, { status: 'completed' });
```

### Python

```python
from dashclaw import DashClaw

claw = DashClaw(
    base_url='https://your-dashclaw.com',
    api_key='your-api-key',
    agent_id='my-python-agent'
)

# Guard
decision = claw.guard(action_type='deploy', risk_score=85)
```

---

## 4. Legacy Compatibility (v1)

For developers migrating from DashClaw v1 or those who require experimental platform features (Messaging, Calendar, Workflows), the full original SDK is available via the `legacy` sub-path:

```javascript
import { DashClaw } from 'dashclaw/legacy';
```

*Warning: Legacy methods will return 404 errors if the corresponding API routes have not been restored from the `_archive` directory on the server.*

---

## 5. Core Concepts

### Guard Policies
Defined in the **Policies** page. Policies can **Allow**, **Block**, or **Require Approval** based on risk scores, action types, or frequency.

### Risk Signals
DashClaw automatically detects anomaly patterns (Autonomy Spikes, Repeated Failures, Stale Actions) without any configuration.

### Decision Evidence
Every action produces a **Decision Replay** — a causal chain of why an action was allowed and what the outcome was.

---

## 5. Security Best Practices

- **Never commit API keys.** Use environment variables.
- **Rotate keys.** Revoke and regenerate keys instantly from the **API Keys** page.
- **Set ENCRYPTION_KEY.** Ensure sensitive settings (AI provider keys) are encrypted at rest.
- **Fail Closed.** The DashClaw API surface is protected by default.

---

## 6. FAQ & Troubleshooting

### "My action isn't showing up"
- Check your `baseUrl` and `apiKey`.
- Verify the agent filter dropdown in the dashboard header is set to "All Agents" or your specific `agentId`.

### "Guard is blocking my actions"
- Check the **Policies** page to see active rules.
- During development, you can use `guardMode: 'warn'` to log blocks without throwing errors.

---

## 7. Support & Community
- **Website:** [dashclaw.io](https://dashclaw.io)
- **GitHub:** [ucsandman/DashClaw](https://github.com/ucsandman/DashClaw)
