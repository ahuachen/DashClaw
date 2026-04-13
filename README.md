<div align="center">
  <img src="public/images/logo-circular.png" alt="DashClaw" width="240" />
  <h1>DashClaw</h1>
  <p><strong>Decision Infrastructure for AI agents.</strong></p>
  <p>Stop agents before they make expensive mistakes.</p>
  <p><sub>Try it in 10 seconds</sub></p>
  <pre><code>npx dashclaw-demo</code></pre>
  <p><sub>No setup. Opens Decision Replay automatically.</sub></p>

  <img src="public/images/demo-gif2.gif" alt="DashClaw Demo" width="1000" />

<br />
<p><strong>Works with:</strong></p>
<p>LangChain · CrewAI · OpenAI · Anthropic · AutoGen · Claude Code · Claude Managed Agents · Codex · Gemini CLI · Custom agents</p>
  <br />
  <p>Intercept decisions. Enforce policies. Record evidence.</p>
  <br />
  <p><strong>Agent &rarr; DashClaw &rarr; External Systems</strong></p>
  <p>DashClaw sits between your agents and your external systems. It evaluates policies before an agent action executes and records verifiable evidence of every decision.</p>
  <br />
  <p><a href="https://dashclaw.io/demo">View Live Demo</a></p>

  <a href="https://dashclaw.io"><img src="https://img.shields.io/badge/website-dashclaw.io-orange?style=flat-square" alt="Website" /></a>
  <a href="https://dashclaw.io/docs"><img src="https://img.shields.io/badge/docs-SDK%20%26%20API-blue?style=flat-square" alt="Docs" /></a>
  <a href="https://github.com/ucsandman/DashClaw/stargazers"><img src="https://img.shields.io/github/stars/ucsandman/DashClaw?style=flat-square&color=yellow" alt="GitHub stars" /></a>
  <a href="https://github.com/ucsandman/DashClaw/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" /></a>
  <a href="https://www.npmjs.com/package/dashclaw"><img src="https://img.shields.io/npm/v/dashclaw?style=flat-square&color=orange" alt="npm" /></a>
  <a href="https://pypi.org/project/dashclaw/"><img src="https://img.shields.io/pypi/v/dashclaw?style=flat-square&color=orange" alt="PyPI" /></a>

</div>

<br />

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fucsandman%2FDashClaw&env=DATABASE_URL,DASHCLAW_API_KEY,ENCRYPTION_KEY,NEXTAUTH_SECRET,NEXTAUTH_URL,CRON_SECRET,DASHCLAW_LOCAL_ADMIN_PASSWORD&envDescription=Required%20DashClaw%20configuration.%20See%20.env.example%20for%20details.&envLink=https%3A%2F%2Fgithub.com%2Fucsandman%2FDashClaw%2Fblob%2Fmain%2F.env.example&project-name=my-dashclaw&repository-name=my-dashclaw&products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D&skippable-integrations=1)

**$0 to deploy** — Vercel free tier + Neon free tier. Click the button, add the Neon integration when prompted, fill in the environment variables, and you're live. Database schema is created automatically during the build — no manual migration step required.

### After deploy

1. **Open your app** — Visit `https://your-app.vercel.app` and sign in.
2. **Copy the snippet** — Mission Control shows a ready-to-run code example with your base URL pre-filled and your API key one click away.
3. **Run it** — `node --env-file=.env demo.js` and watch governance happen.

#### Optional

- **Live decision stream** — Create a free [Upstash Redis](https://upstash.com) instance and add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel env vars. Without this, Mission Control uses in-memory events (fine for getting started, but won't persist across serverless invocations).

## Connect Your Agent

**Five ways to get governed — pick what fits your workflow:**

### Option 1: MCP Server (zero code)

For Claude Code, Claude Desktop, and Claude Managed Agents. The `@dashclaw/mcp-server` package gives your agent 8 governance tools and 4 resources over MCP — no SDK integration needed.

**Claude Code / Claude Desktop (stdio):**

```json
{
  "mcpServers": {
    "dashclaw": {
      "command": "npx",
      "args": ["@dashclaw/mcp-server"],
      "env": {
        "DASHCLAW_URL": "https://your-dashclaw.vercel.app",
        "DASHCLAW_API_KEY": "oc_live_xxx"
      }
    }
  }
}
```

**Claude Managed Agents (Streamable HTTP):**

DashClaw exposes a built-in MCP endpoint at `/api/mcp` — no npm package needed:

```python
agent = client.beta.agents.create(
    name="Governed Agent",
    model="claude-sonnet-4-6",
    tools=[{"type": "agent_toolset_20260401"}],
    mcp_servers=[{
        "type": "url",
        "url": "https://your-dashclaw.vercel.app/api/mcp",
        "headers": {"x-api-key": "oc_live_xxx"},
        "name": "dashclaw"
    }],
)
```

Optionally attach the **governance skill** to teach the agent the full governance protocol (risk thresholds, decision handling, session lifecycle). See [Governance Skill](#governance-skill) below.

### Option 2: Install the skill (30 seconds)

Give your AI agent the `dashclaw-platform-intelligence` skill and it instruments itself — no code changes, no manual wiring. The agent registers with DashClaw, sets up guard checks, records decisions, and starts tracking assumptions automatically.

```bash
# Download the skill into your agent's skill directory
cp -r public/downloads/dashclaw-platform-intelligence .claude/skills/
```

Set two environment variables and your agent is governed on its next run:
```bash
export DASHCLAW_BASE_URL=https://your-dashclaw-instance.com
export DASHCLAW_API_KEY=your_api_key
```

### Option 3: Drop in Claude Code hooks (zero-code)

Govern 40+ tool types with semantic classification — every Bash, Edit, Write, MultiEdit, and more — no SDK instrumentation needed. The bundled `dashclaw_agent_intel` module handles tool classification, risk scoring, and signal extraction automatically:

```bash
cp hooks/dashclaw_pretool.py  .claude/hooks/
cp hooks/dashclaw_posttool.py .claude/hooks/
```

Set `DASHCLAW_BASE_URL`, `DASHCLAW_API_KEY`, and `DASHCLAW_HOOK_MODE=enforce`. Every tool call becomes a governed, replayable decision record. See [hooks/README.md](hooks/README.md) for the full guide.

### Option 4: Use the SDK (full control)

For custom agents where you want precise control over what gets governed:

```bash
npm install dashclaw    # Node.js
pip install dashclaw    # Python
```

The 4-step governance loop — Guard, Record, Verify, Outcome — is covered in the [Quickstart](#quickstart) below.

For framework-specific step-by-step guides (Claude Code, OpenAI Agents SDK, LangGraph, CrewAI), visit [`/connect`](https://dashclaw.io/connect) on your DashClaw instance.

### Option 5: OpenClaw plugin (framework-native)

For agents built on the [OpenClaw](https://github.com/openclaw) framework, `@dashclaw/openclaw-plugin` wires governance directly into the lifecycle:

```bash
npm install @dashclaw/openclaw-plugin
```

It intercepts `PreToolUse` / `PostToolUse`, calls `guard` / `record` / `waitForApproval` automatically, and ships a `HOOK.md` pack the `openclaw` CLI installs. Tool-classification vocabulary aligns with DashClaw guard action types so policies behave consistently whether the call came from a plugin, a hook, or a direct SDK call. See [`packages/openclaw-plugin/README.md`](./packages/openclaw-plugin/README.md).

---

## What is DashClaw?

DashClaw is not observability. It is **control before execution**.

AI agents generate actions from goals and context. They do not follow deterministic code paths. Therefore debugging alone is insufficient. **Agents require governance.**

DashClaw provides decision infrastructure to:
* Intercept risky agent actions before execution.
* Enforce policy checks (risk thresholds, approval requirements, action blocks).
* Require human approval (HITL) for sensitive operations.
* Record verifiable decision evidence for compliance and audit.
* Govern external API calls through the capability registry.
* Run multi-step workflows with governance at every step.

---

## MCP Server

The [`@dashclaw/mcp-server`](./mcp-server) package exposes DashClaw governance over Model Context Protocol.

**8 tools:**

| Tool | Purpose |
|---|---|
| `dashclaw_guard` | Evaluate policies before risky actions |
| `dashclaw_record` | Log actions to audit trail |
| `dashclaw_invoke` | Execute governed capabilities |
| `dashclaw_capabilities_list` | Discover available APIs |
| `dashclaw_policies_list` | See active governance policies |
| `dashclaw_wait_for_approval` | Wait for human approval |
| `dashclaw_session_start` | Register agent session |
| `dashclaw_session_end` | Close agent session |

**4 resources:**

| URI | Description |
|---|---|
| `dashclaw://policies` | Active policy set |
| `dashclaw://capabilities` | Available capabilities and health |
| `dashclaw://agent/{agent_id}/history` | Recent action history |
| `dashclaw://status` | Instance health and metrics |

**Dual transport:** `stdio` for local agents (Claude Code, Claude Desktop) via the npm package; Streamable HTTP at `/api/mcp` for remote agents (Managed Agents, custom).

### Governance Skill

The `dashclaw-governance` skill teaches agents the governance protocol via progressive disclosure — risk assessment thresholds, guard decision handling, session lifecycle, and capability invocation. Pair it with the MCP server for best results:

```bash
# Upload the governance skill (returns a skill ID for use with Managed Agents)
node scripts/upload-skill.mjs
```

The skill is at [`public/downloads/dashclaw-governance/`](./public/downloads/dashclaw-governance/).

---

## Platform Overview

<div align="center">

**Mission Control** — Real-time strategic posture, decision timeline, and intervention feed.

<img src="public/images/screenshots/Mission Control.png" alt="Mission Control" width="1000" />

<br /><br />

**Approval Queue** — Human-in-the-loop intervention with risk scores and one-click Allow / Deny.

<img src="public/images/screenshots/Approvals.png" alt="Approval Queue" width="1000" />

<br /><br />

**Guard Policies** — Declarative rules that govern agent behavior before actions execute.

<img src="public/images/screenshots/policies.png" alt="Guard Policies" width="1000" />

<br /><br />

**Drift Detection** — Statistical behavioral drift analysis with critical alerts when agents deviate from baselines.

<img src="public/images/screenshots/Assumptions.png" alt="Drift Detection" width="1000" />

</div>

---

## Market Intelligence Demo

Seed a full-stack governance demo with one command — knowledge collections, capabilities, policies, model strategy, and a 5-step workflow:

```bash
node scripts/seed-demo-capabilities.mjs
```

| What's Seeded | Details |
|---|---|
| Knowledge Collection | 3 strategy documents (roadmap, competitors, markets) |
| Capabilities | 5 real HTTP APIs at different risk levels |
| Policies | 3 guard policies (auto-allow, warn, require approval) |
| Model Strategy | Balanced analysis strategy (Claude Sonnet) |
| Workflow Template | 5-step "Daily Market Briefing" |

Open **Workflows**, find "Daily Market Briefing", and click **Run**. Watch Mission Control light up as each step executes — knowledge search, API fetches, LLM analysis, and a publish step that pauses for human approval. See [DEMO.md](DEMO.md) for the full walkthrough.

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
  baseUrl: process.env.DASHCLAW_BASE_URL, // or your DashClaw instance URL
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'my-agent'
});
```

**Python:**
```python
from dashclaw.client import DashClaw, GuardBlockedError, ApprovalDeniedError
import os

claw = DashClaw(
    base_url=os.environ["DASHCLAW_BASE_URL"],
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
  assumption: 'The database is read-only for these credentials'
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

## CLI Approval Channel

Approve agent actions from the terminal without opening a browser. This is the primary interface for developers using Claude Code, Codex, Gemini CLI, or any terminal-first workflow.

```bash
npm install -g @dashclaw/cli
```

```bash
dashclaw approvals              # interactive inbox for all pending actions
dashclaw approve <actionId>     # approve a specific action
dashclaw deny <actionId> --reason "Outside change window"
```

When an agent calls `waitForApproval()`, the SDK prints the action ID, risk score, and replay link to stdout. Approve from any terminal and the agent unblocks instantly via SSE.

### Mobile PWA (`/approve`)

Every DashClaw instance ships a phone-first approval surface at `/approve`. Add it to the home screen and incoming approvals appear with the triggering policy, risk score, and one-tap Allow / Deny. Same `/api/approvals/:id` endpoint as the dashboard and CLI — `waitForApproval` unblocks within ~1 second regardless of which surface resolved the action. See [`app/approve/`](./app/approve/).

### Doctor (diagnose & auto-fix)

Validate your DashClaw setup and apply safe fixes automatically. Runs checks across database, configuration, auth, deployment, SDK reachability, and governance.

```bash
# Self-hosters: check the local instance (full access — env, DB, filesystem)
npm run doctor                  # rich terminal output, auto-fixes what it can
npm run doctor -- --json        # JSON for CI
npm run doctor -- --no-fix      # diagnose only
npm run doctor -- --category database,config

# Agent developers: check a remote instance via the CLI
dashclaw doctor                 # auto-fix what it can via /api/doctor/fix
dashclaw doctor --no-fix        # diagnose only
dashclaw doctor --json          # JSON for CI
dashclaw logout                 # remove saved config
```

**First-run config.** On first use, the CLI prompts for `DASHCLAW_BASE_URL` and `DASHCLAW_API_KEY` (masked) and offers to save them to `~/.dashclaw/config.json` (mode `600`). Env vars always override the saved values. In CI, set them as env vars — the CLI detects non-TTY and errors out cleanly instead of hanging on stdin.

The doctor auto-fixes missing secrets, runs pending migrations, creates a default governance policy, and writes CORS settings. Every non-passing check gets an inline next-step hint telling you exactly what to do. Env var values are never exposed in the output.

---

## Telegram approvals (optional)

When an action lands on `pending_approval`, DashClaw can ping a Telegram admin chat with inline Approve / Reject buttons. One tap on your phone resolves the action.

### Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) and grab the bot token.
2. Message your bot once; open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy your numeric `chat.id`.
3. Generate a webhook secret: `openssl rand -hex 32`.
4. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, and `TELEGRAM_APPROVER_ORG_ID` in your deploy's env.
5. Register the webhook:

   ```bash
   npm run telegram:register -- --url https://my-dashclaw.vercel.app
   ```

6. (Optional) Smoke test the round-trip:

   ```bash
   DASHCLAW_API_KEY=oc_live_… npm run telegram:verify -- --base https://my-dashclaw.vercel.app
   ```

   Tap Approve on your phone — the script prints the round-trip time.

Telegram is an *additional* approval channel. The dashboard, CLI, and mobile PWA continue to work. If Telegram is unreachable, DashClaw warn-logs and moves on; approvals stay available via the other surfaces.

See also: `.env.example` (Telegram section), `app/lib/telegramApprovals.js`, `app/api/telegram/webhook/route.js`, `scripts/telegram-register-webhook.mjs`, `scripts/telegram-verify-loop.mjs`, `docs/telegram-setup.md` for the detailed walkthrough.

---

## Beyond the Basics

| Feature | Description | Docs |
|---|---|---|
| Drift Detection | Monitors reasoning and metric drift across sessions, surfaces signals on deviation | [SDK: Learning Loop](./sdk/README.md#learning-loop) |
| Recovery Recipes | 6 built-in recipes mapping signals to remediations and auto-actions | [SDK: Recovery](./sdk/README.md#learning-loop) |
| Scoring Profiles | Multi-dimensional evaluation with weighted composites and auto-calibration | [SDK: Scoring](./sdk/README.md#scoring-profiles) |
| Learning Loop | Guard responses include historical context — score averages, drift status, patterns | [SDK: Learning](./sdk/README.md#learning-loop) |
| Prompt Injection Scanning | On by default. Detects and blocks injection patterns in declared goals | [SDK: Security](./sdk/README.md#security-scanning) |
| Session Lifecycle | Automatic tracking with stall detection, recovery, and graduated autonomy | [CHANGELOG](./CHANGELOG.md) |
| Capability Registry | Full CRUD, HTTP invocation, health monitoring, and per-agent access rules | [Capability Runtime](./sdk/README.md#capability-runtime) |
| Workflow Engine | 3 step types, variable substitution, `continue_on_failure`, resume from checkpoint | [DEMO.md](./DEMO.md) |
| Agent Profiles | Per-agent governance dashboard: trust posture, decision history, assumptions, active signals, and policies at `/agents/[agentId]` | [PROJECT_DETAILS.md](./PROJECT_DETAILS.md) |
| Policy Builder | Shields-first policy experience with 8 pre-built safety switches (Deploy Gate, Risk Threshold, Rate Limiter, etc.), AI generator, YAML import, and guard activity feed at `/policies` | [PROJECT_DETAILS.md](./PROJECT_DETAILS.md) |
| Analytics | Cost trends, action volume, agent and type breakdowns, policy enforcement stats, and token efficiency with 7d/30d/90d time ranges at `/analytics` | [PROJECT_DETAILS.md](./PROJECT_DETAILS.md) |

---

## Local SDK Testing

```bash
export DASHCLAW_API_KEY="your-api-key"
export DASHCLAW_BASE_URL="http://localhost:3000"
python scripts/test-sdk-agent.py --full
```

---

## Documentation

- [SDK README](./sdk/README.md) — Canonical reference for the `dashclaw` npm package (80 v2 methods + canonical HITL flow)
- [SDK Parity Matrix](./docs/sdk-parity.md) — Node v2 vs Node legacy vs Python surface coverage
- [Architecture](./PROJECT_DETAILS.md) — System map, boundary rules, and SDK surface inventory
- [Runtime API](./docs/architecture/runtime-api.md) — The minimal core governance endpoints
- [Roadmap](./ROADMAP.md) — What's shipped, in progress, and exploring
- [CHANGELOG](./CHANGELOG.md) — Detailed release history

---

## License

[MIT](LICENSE)

<div align="center">
  <br />
  <img src="public/images/github-social-preview-ps.png" alt="Practical Systems" width="600" />
  <br />
  <sub>Built by <a href="https://practicalsystems.io">Practical Systems</a></sub>
</div>
