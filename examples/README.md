# DashClaw Examples

Terminal-first governance examples showing the full decision loop: guard check, action recording, approval gate, and outcome tracking.

## Two-terminal demo

The recommended way to run any example with an approval gate:

```bash
# Terminal 1: Run the agent
cd examples/openai-deploy-pipeline
npm install
node index.js

# Terminal 2: Approve when the gate fires
dashclaw approve act_<id shown in Terminal 1>
```

## Examples

| Example | SDK | Language | Governance Scenario |
|---|---|---|---|
| `openai-governed-agent` | OpenAI | Node.js | Customer refund email governance |
| `claude-code-review-agent` | Anthropic | Node.js | Security fix approval gate |
| `openai-deploy-pipeline` | OpenAI | Node.js | Production deploy approval with CLI |
| `python-research-agent` | None (simulated) | Python | File write governance |

### openai-governed-agent

The original starter example. An OpenAI agent deploys a service to production. Shows guard, action, assumption, and outcome recording.

### claude-code-review-agent

A Claude-powered agent reviews `sample-auth.js` for security issues. The file write triggers `require_approval` because the target path matches the `auth` risk pattern. Works without an Anthropic API key (uses simulated review output).

### openai-deploy-pipeline

A CI/CD pipeline agent that runs pre-flight checks, gets an AI readiness assessment, and attempts a production deploy. The deploy action has risk 85 and is irreversible, which triggers the approval gate. Includes simulated rolling pod updates after approval.

### python-research-agent

A Python agent that researches a topic and writes a report. Demonstrates the Python SDK governance flow. Requires no AI API key at all.

## Prerequisites

All examples need:
- A running DashClaw instance (`npm run dev` from the repo root)
- `DASHCLAW_API_KEY` from your instance

Node examples additionally need Node.js 20+. The Python example needs Python 3.10+.

Each example includes a `.env.example` file. Copy it to `.env` and fill in your keys before running.
