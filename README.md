<div align="center">
  <img src="public/images/logo-circular.png" alt="DashClaw" width="240" />
  <h1>DashClaw</h1>
  <p><strong>Decision Infrastructure for AI agents.</strong></p>
  <p>Govern AI agents before they act.</p>
  <br />
  <p>Try it instantly:</p>
  <code>npx dashclaw-demo</code>
  <br />
  <br />
  <p>Intercept decisions. Enforce policies. Record evidence.</p>
  <br />
  <p><strong>Agent &rarr; DashClaw &rarr; External Systems</strong></p>
  <p>DashClaw sits between your agents and your external systems. It evaluates policies before an agent action executes and records verifiable evidence of every decision.</p>
  <br />
  <p><a href="https://www.dashclaw.io/mission-control">View Live Demo</a></p>

  <a href="https://dashclaw.io"><img src="https://img.shields.io/badge/website-dashclaw.io-orange?style=flat-square" alt="Website" /></a>
  <a href="https://dashclaw.io/docs"><img src="https://img.shields.io/badge/docs-SDK%20%26%20API-blue?style=flat-square" alt="Docs" /></a>
  <a href="https://github.com/ucsandman/DashClaw/stargazers"><img src="https://img.shields.io/github/stars/ucsandman/DashClaw?style=flat-square&color=yellow" alt="GitHub stars" /></a>
  <a href="https://github.com/ucsandman/DashClaw/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" /></a>
  <a href="https://www.npmjs.com/package/dashclaw"><img src="https://img.shields.io/npm/v/dashclaw?style=flat-square&color=orange" alt="npm" /></a>
  <a href="https://pypi.org/project/dashclaw/"><img src="https://img.shields.io/pypi/v/dashclaw?style=flat-square&color=orange" alt="PyPI" /></a>

  <img src="public/images/screenshots/replay2.png" alt="DashClaw Replay" width="2500" />
</div>

<br />

---

## What is DashClaw?

AI agents generate actions from goals and context. They do not follow deterministic code paths. Therefore debugging alone is insufficient. **Agents require governance.**

DashClaw provides decision infrastructure to:
* Intercept risky agent actions.
* Enforce policy checks before execution.
* Require human approval (HITL) for sensitive operations.
* Record verifiable decision evidence to detect reasoning drift.

---

## ⚡ 1-Minute Governance Demo

Run DashClaw instantly with **one command**.

```bash
npx dashclaw-demo
```

What happens:
1. A local DashClaw demo runtime starts automatically.
2. A demo agent attempts a **high-risk production deploy**.
3. DashClaw intercepts the decision and **blocks the action before execution**.
4. Your browser opens directly to the **Decision Replay** showing the governance trail.

No repo clone. No environment variables. No configuration. Just one command.

---

## Quickstart

### 1. Install the SDK

**Node.js:**
```bash
npm install dashclaw
```

**Python:**
```bash
pip install dashclaw
```

### 2. Create the Client

**Node.js:**
```javascript
import { DashClaw, GuardBlockedError, ApprovalDeniedError } from 'dashclaw';

const claw = new DashClaw({
  baseUrl: 'http://localhost:3000', // or your DashClaw instance URL
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'my-agent'
});
```

**Python:**
```python
from dashclaw.client import DashClaw, GuardBlockedError, ApprovalDeniedError
import os

claw = DashClaw(
    base_url='http://localhost:3000',
    api_key=os.environ.get('DASHCLAW_API_KEY'),
    agent_id='my-agent'
)
```

### 3. Run Your First Governed Action

The minimal governance loop wraps your agent's real-world actions:

```javascript
// 1. Guard -> "Can I do X?"
const decision = await claw.guard({
  action_type: 'database_query',
  risk_score: 50
});

// 2. Record -> "I am attempting X."
const action = await claw.createAction({
  action_type: 'database_query',
  declared_goal: 'Extract user statistics'
});

// 3. Verify -> "I believe Y is true while doing X."
await claw.recordAssumption({
  action_id: action.action_id,
  assumption: 'The database is read-only for this credentials'
});

try {
  // Execute the real action here...
  // ...

  // 4. Outcome -> "X finished with result Z."
  await claw.updateOutcome(action.action_id, { status: 'completed' });
} catch (error) {
  await claw.updateOutcome(action.action_id, { status: 'failed', error_message: error.message });
}
```

---

## Local SDK Testing

DashClaw includes a standalone Python integration test agent that exercises the major DashClaw SDK methods directly against a running instance.

To run it locally:
```bash
export DASHCLAW_API_KEY="your-api-key"
export DASHCLAW_BASE_URL="http://localhost:3000"

# Run the full SDK test agent
python scripts/test-sdk-agent.py --full
```
See the script comments for more flags and usage.

---

## Deploy to Cloud (Self-Host)

The fastest path to self-host DashClaw is via **Vercel + Neon**.

1. Create a free database at [neon.tech](https://neon.tech).
2. Fork this repo.
3. Deploy to Vercel and set `DATABASE_URL`.
4. Your instance is live instantly.

---

## Full SDK Documentation

For the complete API surface, check out the [SDK Reference](./docs/sdk-reference.md).

---

## License

[MIT](LICENSE)
