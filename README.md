<div align="center">
  <img src="public/images/logo-circular.png" alt="DashClaw" width="240" />
  <h1>DashClaw</h1>
  <p><strong>Decision infrastructure for AI agents</strong></p>
  <p>Intercept. Govern. Verify.</p>
  <p>DashClaw is a policy firewall that intercepts agent actions before they reach real systems.</p>
  <br />
  <p><strong>Agent &rarr; DashClaw (Policy Engine) &rarr; External Systems</strong></p>
  <br />
  <p><a href="https://www.dashclaw.io/mission-control">View Demo</a></p>

  <a href="https://dashclaw.io"><img src="https://img.shields.io/badge/website-dashclaw.io-orange?style=flat-square" alt="Website" /></a>
  <a href="https://dashclaw.io/docs"><img src="https://img.shields.io/badge/docs-SDK%20%26%20API-blue?style=flat-square" alt="Docs" /></a>
  <a href="https://github.com/ucsandman/DashClaw/stargazers"><img src="https://img.shields.io/github/stars/ucsandman/DashClaw?style=flat-square&color=yellow" alt="GitHub stars" /></a>
  <a href="https://github.com/ucsandman/DashClaw/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" /></a>
  <a href="https://www.npmjs.com/package/dashclaw"><img src="https://img.shields.io/npm/v/dashclaw?style=flat-square&color=orange" alt="npm" /></a>
  <a href="https://pypi.org/project/dashclaw/"><img src="https://img.shields.io/pypi/v/dashclaw?style=flat-square&color=orange" alt="PyPI" /></a>

  <img src="screenshots/replay.png" alt="DashClaw Replay" width="2500" />
</div>

<br />

---

## Why DashClaw Exists

AI agents don't just generate text — they execute actions. They deploy code, modify databases, and interact with production systems.

DashClaw provides the **minimal governance infrastructure** to intercept these actions before they happen.

---

## The Minimal Governance Loop

DashClaw sits between your agents and your systems:

1. **Guard** &rarr; `claw.guard()` checks intent against policy.
2. **Record** &rarr; `claw.createAction()` logs the attempt.
3. **Verify** &rarr; `claw.recordAssumption()` tracks the "why" to detect reasoning drift.
4. **Outcome** &rarr; `claw.updateOutcome()` records the final evidence.

---

## Quick Start (Node.js)

```bash
npm install dashclaw
```

```javascript
import { DashClaw } from 'dashclaw';

const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL,
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'my-agent'
});

// 1. Ask for permission
const decision = await claw.guard({ 
  action_type: 'deploy', 
  risk_score: 85 
});

// 2. Record the action
const action = await claw.createAction({
  action_type: 'deploy',
  declared_goal: 'Deploying latest build'
});

// 3. Record the result
await claw.updateOutcome(action.action_id, { 
  status: 'completed' 
});
```

---

## Minimal SDK Surface (v2)

DashClaw v2 is optimized for first-time adoption with only **5 core methods**:

*   `guard(context)` — Policy evaluation ("Can I do X?")
*   `createAction(action)` — Lifecycle tracking ("I am doing X")
*   `updateOutcome(id, outcome)` — Result recording ("X finished with Y")
*   `recordAssumption(assumption)` — Integrity tracking ("I believe Z while doing X")
*   `waitForApproval(id)` — Polling helper for human-in-the-loop

Legacy features (Calendar, Messages, Workflows) have been moved to **Extensions**.
4. **Verifiable Evidence** — Cryptographically signed decision replays are recorded for audit.

---

## What DashClaw Solves

AI agents can execute actions with real-world consequences.

DashClaw sits between agents and external systems, enforcing guard policies before actions execute and recording verifiable decision evidence afterward.

---

## Project Structure

DashClaw is organized into a lean governance runtime with modular extensions.

- **`/app/(core)`** — **The Governance Runtime UI**. Mission Control, Decisions, Policies, and Approvals.
- **`/app/(extensions)`** — **Labs & Experimental Infrastructure**. Behavioral drift, learning loops, and task routing.
- **`/app/(archive)`** — **Legacy Artifacts**. Preserved historical features (Goals, Messages, etc.).
- **`/app/api`** — **The Stable Runtime API**. Small, idempotent primitives for agent integration.
- **`/sdk`** — **Lightweight SDKs**. Node and Python clients for the governance lifecycle.

---

## Minimal Runtime API

DashClaw provides a small, stable API surface for governing any agent:

1. **`POST /api/guard`** — "Can I do X?" (Policy check)
2. **`POST /api/actions`** — "I am attempting X." (Action registration)
3. **`PATCH /api/actions/:id`** — "X finished with result Y." (Outcome recording)
4. **`POST /api/assumptions`** — "I believe Z is true while doing X." (Reasoning ledger)
5. **`POST /api/approvals/:id`** — "Operator says Allow/Deny for X." (Human-in-the-loop)

Everything else (UI, Analytics, Extensions) maps back to these five primitives.

---

## SDK v2 (Alpha)

The new **DashClaw SDK v2** focuses on the minimal runtime API for better stability and lower latency.

```javascript
import { DashClaw } from './sdk/dashclaw-v2.js';

const claw = new DashClaw({
  baseUrl: 'https://your-dashclaw.com',
  apiKey: 'key_...',
  agentId: 'my-agent'
});

// 1. Guard
const decision = await claw.guard({
  action: 'deploy',
  intent: 'deploy latest commit to production'
});

if (decision.decision === 'block') throw new Error('Policy blocked action');

// 2. Act
const { action_id } = await claw.createAction({
  action_type: 'deploy',
  declared_goal: 'deploy latest commit to production'
});

// 3. Result
await claw.updateOutcome(action_id, { status: 'completed' });
```

---

## Core Capabilities

- **Mission Control** — High-level control tower for fleet posture and active interventions.
- **Guard Engine** — Zero-latency policy enforcement before agents reach external systems.
- **Decision Replay** — Visual, shareable causal chains of every governed action.
- **Agent Dossiers** — Dedicated governance profiles tracking posture, policies, and history.
- **Risk Signals** — Automated detection of autonomy spikes and failure loops.
- **Compliance Evidence** — Generate audit-ready reports for SOC 2, GDPR, and EU AI Act.

---

## 🚀 1-Minute Path to Governance

Experience the magic of autonomous governance in under 60 seconds.

```bash
# 1. Clone the repo
git clone https://github.com/ucsandman/DashClaw
cd DashClaw/examples

# 2. Install dependencies
npm install

# 3. Run the first governed action
node first-governed-action.js
```

The example sends a governed decision to the DashClaw demo instance. 
Open **[Mission Control](https://www.dashclaw.io/mission-control)** to watch the intercepted decision appear in real time.

> **Running your own instance?**  
> If you're running DashClaw locally or on Vercel, set `DASHCLAW_BASE_URL` to your deployment URL first.  
>  
> Examples:  
> `DASHCLAW_BASE_URL=http://localhost:3000 node first-governed-action.js`  
> `DASHCLAW_BASE_URL=https://your-app.vercel.app node first-governed-action.js`

---

## Works With Your Agent Stack

DashClaw can govern decisions from any agent runtime.

Common integrations include:

• LangChain agents  
• CrewAI agents  
• OpenAI tool agents  
• Anthropic tool agents  
• OpenClaw agents  
• Custom agent frameworks

---

## Platform Expansion

Once decisions are governed, DashClaw provides operational visibility for agent fleets.

- **Mission Control dashboard** — operational visibility for agent fleets.
- **Decision Replay** — causal chain visualization for every governed action.
- **Agent Fleet Management** — health, permissions, and health overview.
- **Compliance evidence** — generate audit-ready reports.

<img src="screenshots/decision4.png" alt="DashClaw Decisions" width="2500" />

---

## How It Works

DashClaw is a single Next.js codebase that serves two roles:

| | **dashclaw.io** (marketing) | **Your deployment** (self-hosted) |
|---|---|---|
| **Landing page** | Marketing site with demo | Same page, "Mission Control" goes to your real dashboard |
| **Mission Control** | Demo with fixture data, no login | Real dashboard with Password or GitHub/Google/OIDC OAuth |
| **Data** | Hardcoded fixtures | Your Postgres database |
| **`DASHCLAW_MODE`** | `demo` | `self_host` (default) |

---

## Product Surfaces

| Route | Description | Tier |
|-------|-------------|------|
| `/mission-control` | Control tower for agent fleet posture | Core |
| `/decisions` | Decisions Ledger: global stream of governed actions | Core |
| `/decisions/[id]` | Decision Replay: visual causal chain of a decision | Core |
| `/policies` | Guardrail and policy management | Core |
| `/agents` | Fleet overview and agent dossiers | Supporting |
| `/activity` | Real-time operational telemetry feed | Supporting |
| `/labs` | Experimental safety research (Swarm, Learning, Prompts) | Experimental |
| `/audit-log` | Immutable record of system/admin changes | Core |

---

## Deploy to Cloud

The fastest path: **Vercel free tier + Neon free tier**.

1. Create a free database at [neon.tech](https://neon.tech)
2. Fork this repo to your GitHub
3. Import at [vercel.com/new](https://vercel.com/new)
4. Generate secrets and set environment variables (see [docs/client-setup-guide.md](docs/client-setup-guide.md)).
5. Deploy. Tables are created automatically on first request.

---

## Security

- API surface fails closed with `503` if `DASHCLAW_API_KEY` is not set.
- Rate limiting enforced on all `/api/*` routes.
- AES-256 encryption for sensitive settings.
- Multi-tenant isolation by default.

See [docs/SECURITY.md](docs/SECURITY.md).

---

## Community

<div align="center">
  <a href="https://dashclaw.io">Website</a> &bull;
  <a href="https://dashclaw.io/docs">Documentation</a> &bull;
  <a href="https://github.com/ucsandman/DashClaw/issues">Issues</a>
</div>

---

## License

[MIT](LICENSE) -- use it however you want.

<div align="center">
  <br />
  <img src="public/images/github-social-preview-ps.png" alt="Practical Systems" width="600" />
  <br />
  <sub>Built by <a href="https://practicalsystems.io">Practical Systems</a></sub>
</div>
