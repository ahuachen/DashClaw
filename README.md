<div align="center">
  <img src="public/images/github-social-preview.png" alt="DashClaw" width="240" />
  <h1>DashClaw</h1>
  <p><strong>AI Agent Governance, Operations, and Intelligence Platform</strong></p>
  <p>The self-hosted control plane for running serious AI agent fleets.<br/>Govern decisions before agents act, route work to the right agent, score output quality, track learning, manage context and messaging, and generate audit-ready compliance evidence.</p>
  <p><a href="https://www.dashclaw.io/mission-control">Demo</p>

  <a href="https://dashclaw.io"><img src="https://img.shields.io/badge/website-dashclaw.io-orange?style=flat-square" alt="Website" /></a>
  <a href="https://dashclaw.io/docs"><img src="https://img.shields.io/badge/docs-SDK%20%26%20API-blue?style=flat-square" alt="Docs" /></a>
  <a href="https://github.com/ucsandman/DashClaw/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" /></a>
  <a href="https://www.npmjs.com/package/dashclaw"><img src="https://img.shields.io/npm/v/dashclaw?style=flat-square&color=orange" alt="npm" /></a>
  <a href="https://pypi.org/project/dashclaw/"><img src="https://img.shields.io/pypi/v/dashclaw?style=flat-square&color=orange" alt="PyPI" /></a>

  <br /><br />

  <img src="screenshots/Mission%20Control3.png" alt="DashClaw Mission Control dashboard" width="1000" />
</div>

<br />

> **Zero LLM required.** Every feature works out of the box without an API key. Optional LLM integration available for advanced scoring.

---

## What DashClaw Has Become

DashClaw started as decision infrastructure. It is now a much broader platform for operating, governing, and improving AI agents in production.

- **Decision governance** -- guard policies, approvals, assumption tracking, open loops, root-cause traceability
- **Operator control plane** -- Mission Control, approval queue, security signals, swarm views, fleet health, audit trail, 15-minute change digests, and decision-native timelines with chain expansion
- **Quality and evaluation** -- scorer framework, weighted scoring profiles, risk templates, auto-calibration
- **Adaptive learning** -- learning episodes, recommendations, adoption telemetry, maturity and velocity analytics
- **Agent workspace** -- handoffs, context threads, shared docs, snippets, messaging, memory health
- **Compliance and security** -- policy testing, proof reports, framework mapping, prompt injection scanning, content security scanning
- **Fleet operations** -- task routing, agent registry, schedules, notifications, webhooks, cron automation, multi-tenant org controls
- **SDK and tooling** -- zero-dependency Node.js and Python SDKs, agent bootstrap scanner, and 30+ local CLI tools

---

## Why DashClaw

Most observability tools tell you *what* your agents did. DashClaw tells you *what they decided, why, whether they should have, and how to improve the next decision.*

- **Govern before execution** -- no-code policies, human approvals, verified agent identity, and decision proof
- **Operate the fleet** -- Mission Control, recent-change digests, decision timelines with parent/child continuity, routing, schedules, notifications, webhooks, and multi-agent coordination
- **Improve over time** -- evaluations, scoring profiles, drift detection, learning recommendations, and maturity analytics
- **Keep context intact** -- messaging, handoffs, workspace docs, snippets, memory health, and agent bootstrap tooling
- **Stay audit-ready** -- compliance mapping, evidence exports, audit logs, security scanning, and self-hosted control
- **Integrate fast** -- zero-dependency Node.js and Python SDKs plus local CLI tools for agent-side workflows

<br />

<table>
  <tr>
    <td align="center" width="25%">
      <strong>Governance</strong><br />
      <sub>Policies, approvals, identity binding, assumptions, proof</sub>
    </td>
    <td align="center" width="25%">
      <strong>Quality &amp; Eval</strong><br />
      <sub>Scorers, scoring profiles, risk templates, auto-calibration</sub>
    </td>
    <td align="center" width="25%">
      <strong>Learning</strong><br />
      <sub>Recommendations, telemetry, maturity, per-skill curves</sub>
    </td>
    <td align="center" width="25%">
      <strong>Operations</strong><br />
      <sub>Mission Control, routing, swarm views, risk and cost signals</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>Workspace</strong><br />
      <sub>Messages, shared docs, handoffs, context, snippets</sub>
    </td>
    <td align="center">
      <strong>Prompt Mgmt</strong><br />
      <sub>Templates, versions, rendering, runs, coverage prompts</sub>
    </td>
    <td align="center">
      <strong>Compliance</strong><br />
      <sub>Framework mapping, gap analysis, reports, evidence bundles</sub>
    </td>
    <td align="center">
      <strong>Security</strong><br />
      <sub>Prompt injection scans, content scanning, OIDC, encryption</sub>
    </td>
  </tr>
</table>

---

## Quick Start

**Prerequisites:** Node.js 20+

```bash
git clone https://github.com/ucsandman/DashClaw.git
cd DashClaw
node scripts/setup.mjs
```

The interactive setup handles everything:

1. **Database** -- checks whether Docker is available before steering you into the local Docker path, or lets you use Neon / any Postgres URL
2. **Secrets** -- auto-generates API key, auth secrets, encryption key
3. **Dashboard login** -- offers a local admin password when no OAuth provider is configured yet
4. **Migrations + readiness check** -- runs migrations, then verifies the same database readiness used by `/api/setup/status`
5. **Build** -- compiles the Next.js app without pretending setup is complete if the app still is not ready

When setup finishes, send operators to `/connect` for the canonical first-agent path. That page gives the shortest trustworthy route for Node or Python: env vars, minimal starter snippet, optional verified pairing, validation, and success criteria.

Optional feature migrations:

- **Prompt analytics** -- run `node scripts/migrate-prompts.mjs` to enable `prompt_runs` usage stats and prompt render telemetry on existing installs that predate prompt analytics.

When it finishes, you get an honest ready/not-ready summary plus a ready-to-use agent connection snippet.

> Platform installers also available: `./install-windows.bat` or `bash ./install-mac.sh`

---

## Connect Your Agent

**Node.js**
```javascript
import DashClaw from 'dashclaw';

const dc = new DashClaw({
  baseUrl: 'https://your-app.vercel.app',
  apiKey: 'oc_live_...'
});

// Track a decision
await dc.createAction({
  agentId: 'my-agent',
  type: 'api_call',
  input: { endpoint: '/users', method: 'POST' },
  output: { status: 201 }
});

// Enforce a policy
const decision = await dc.checkGuard({
  agentId: 'my-agent',
  action: 'send_email',
  context: { recipient_count: 500 }
});
// decision.allowed = false (bulk email blocked by guard)
```

**Python**
```python
from dashclaw import DashClaw

dc = DashClaw(
    base_url="https://your-app.vercel.app",
    api_key="oc_live_..."
)

dc.create_action(
    agent_id="my-agent",
    type="api_call",
    input={"endpoint": "/users", "method": "POST"},
    output={"status": 201}
)
```

---

## How It Works

DashClaw is a single Next.js codebase that serves two roles:

| | **dashclaw.io** (marketing) | **Your deployment** (self-hosted) |
|---|---|---|
| **Landing page** | Marketing site with demo | Same page, "Dashboard" goes to your real dashboard |
| **Dashboard** | Demo with fixture data, no login | Real dashboard with Password or GitHub/Google/OIDC OAuth |
| **Data** | Hardcoded fixtures | Your Postgres database |
| **`DASHCLAW_MODE`** | `demo` | `self_host` (default) |

---

## Product Surfaces

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/dashboard` | Operations dashboard (requires auth) |
| `/connect` | Canonical first-agent connection guide for Node and Python |
| `/swarm` | Real-time swarm intelligence & neural web |
| `/docs` | SDK + platform documentation |
| `/self-host` | Getting started guide |
| `/demo` | Demo sandbox (read-only, no login) |

---

## Deploy to Cloud

The fastest path: **Vercel free tier + Neon free tier**. Accessible from any device, auto-HTTPS.

1. Create a free database at [neon.tech](https://neon.tech)
2. Fork this repo to your GitHub
3. Import at [vercel.com/new](https://vercel.com/new)
4. Generate secrets:
   ```bash
   node -e "const c=require('crypto');console.log('NEXTAUTH_SECRET='+c.randomBytes(32).toString('base64url'));console.log('DASHCLAW_API_KEY=oc_live_'+c.randomBytes(24).toString('hex'));console.log('ENCRYPTION_KEY='+c.randomBytes(32).toString('base64url').slice(0,32));console.log('CRON_SECRET='+c.randomBytes(32).toString('hex'))"
   ```
5. Set environment variables in Vercel:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Your Neon connection string |
   | `NEXTAUTH_URL` | `https://your-app.vercel.app` |
   | `NEXTAUTH_SECRET` | From step 4 |
   | `DASHCLAW_API_KEY` | From step 4 (`oc_live_` prefix required) |
   | `ENCRYPTION_KEY` | From step 4 |
   | `CRON_SECRET` | From step 4 |
   | `DASHCLAW_LOCAL_ADMIN_PASSWORD` | A strong password — lets you sign in without OAuth |

6. Deploy. Tables are created automatically on first request.
7. Visit your app -> **Dashboard** -> sign in with your admin password or OAuth

> Also works on Railway, Fly.io, Render, or any host that runs Node.js.

---

## Deployment Options

| | **Local (Docker)** | **Cloud (Vercel + Neon)** |
|---|---|---|
| **Best for** | Development, privacy, max speed | Remote access from anywhere |
| **Database** | Docker Postgres (direct TCP) | Neon free tier (serverless) |
| **Hosting** | `localhost:3000` | `your-app.vercel.app` |
| **Cost** | Free | Free |

Mix and match: Vercel + self-hosted Postgres, or local + Neon. DashClaw auto-detects your database type.

---

## OAuth Setup

OAuth is optional if you set `DASHCLAW_LOCAL_ADMIN_PASSWORD`. `node scripts/setup.mjs` now offers that path directly when no provider is configured, and you can add OAuth later when you want to invite teammates.

<details>
<summary><strong>GitHub OAuth</strong></summary>

1. Go to [github.com/settings/developers](https://github.com/settings/developers) -> **New OAuth App**
2. Callback URL:
   - Local: `http://localhost:3000/api/auth/callback/github`
   - Cloud: `https://your-app.vercel.app/api/auth/callback/github`
3. Add `GITHUB_ID` and `GITHUB_SECRET` to your env

</details>

<details>
<summary><strong>Google OAuth (optional)</strong></summary>

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Callback URL:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Cloud: `https://your-app.vercel.app/api/auth/callback/google`
3. Add `GOOGLE_ID` and `GOOGLE_SECRET`

</details>

<details>
<summary><strong>OIDC (Authentik, Keycloak, etc.)</strong></summary>

1. Callback URL: `https://your-app.vercel.app/api/auth/callback/oidc`
2. Add `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`
3. Optional: `OIDC_DISPLAY_NAME` to customize the login button

See [OIDC Setup Guide](docs/OIDC_SETUP.md) for details.

</details>

---

## Bootstrap an Existing Agent

Import an agent's entire workspace into the dashboard:

```bash
# Preview (dry run)
node scripts/bootstrap-agent.mjs \
  --dir "/path/to/agent" \
  --agent-id "my-agent" \
  --dry-run

# Push to cloud
node scripts/bootstrap-agent.mjs \
  --dir "/path/to/agent" \
  --agent-id "my-agent" \
  --base-url "https://your-app.vercel.app" \
  --api-key "oc_live_..."
```

The adaptive scanner auto-discovers and classifies files: identity, skills, tools, relationships, config, creative works, and more. No hardcoded paths needed. See [docs/agent-bootstrap.md](docs/agent-bootstrap.md).

---

## Repo Layout

```
app/            Next.js App Router -- pages, dashboard, API routes, shared libs
sdk/            Node.js SDK (dashclaw)
sdk-python/     Python SDK + CLI tools (dashclaw)
agent-tools/    Local Python CLI suite (optional dashboard sync)
scripts/        Migrations, CI guardrails, OpenAPI + inventory generators
docs/           RFCs, runbooks, parity matrix, governance docs
```

---

## Scheduled Jobs

DashClaw exposes cron endpoints under `/api/cron/*` for maintenance and automation. Use any scheduler (GitHub Actions, system cron, Cloudflare Workers, etc.):

```bash
curl -fsS \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://YOUR_HOST/api/cron/signals"
```

| Endpoint | Purpose |
|----------|---------|
| `/api/cron/signals` | Compute signals, fire webhooks, send alerts |
| `/api/cron/memory-maintenance` | Memory health maintenance |
| `/api/cron/learning-recommendations` | Rebuild learning recommendations |
| `/api/cron/learning-episodes-backfill` | Backfill learning episodes |

---

## CI / Quality Gates

```bash
npm run lint
npm run docs:check
npm run openapi:check
npm run api:inventory:check
npm run route-sql:check
npm run test -- --run
npm run sdk:integration
npm run sdk:integration:python

# Live validation (requires running instance + API key — not in default CI)
npm run sdk:live
npm run sdk:live:python
```

---

## Security

- API surface fails closed with `503` if `DASHCLAW_API_KEY` is not set in production
- Rate limiting enforced on all `/api/*` routes (tunable via `DASHCLAW_RATE_LIMIT_*` env vars)
- AES-256 encryption for sensitive settings
- Multi-tenant isolation by default

See [docs/SECURITY.md](docs/SECURITY.md).

---

## Documentation

| Resource | Description |
|----------|-------------|
| [**PROJECT_DETAILS.md**](PROJECT_DETAILS.md) | Canonical architecture & behavior reference |
| [**QUICK-START.md**](QUICK-START.md) | Non-coding setup guide |
| [**docs/client-setup-guide.md**](docs/client-setup-guide.md) | SDK & operator reference |
| [**docs/agent-bootstrap.md**](docs/agent-bootstrap.md) | Agent import & bootstrap |
| [**docs/sdk-live-validation.md**](docs/sdk-live-validation.md) | SDK live integration testing |
| [**CONTRIBUTING.md**](CONTRIBUTING.md) | Contribution guidelines |

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

