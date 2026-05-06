# @dashclaw/opencode-plugin

DashClaw governance for [opencode](https://github.com/sst/opencode) — every
tool call is policy-gated, optionally human-approved, and recorded as a
governance event with a full audit trail.

## What it does

Wires four opencode hooks into the DashClaw governance loop:

| opencode hook | DashClaw step |
|---|---|
| `tool.execute.before` | `POST /api/guard` → (optional `waitForApproval`) → `POST /api/actions` |
| `tool.execute.after` | `PATCH /api/actions/:id` (outcome) |
| `permission.ask` | `POST /api/guard` → may force `output.status = "deny"` |
| (init / shutdown) | `POST /api/agents/heartbeat` |

When DashClaw decides `block` or a human reviewer denies the action, the hook
**throws** — opencode's plugin trigger surfaces this as a tool failure,
preventing the tool from executing.

## Install

```bash
# In your opencode project
bun add @dashclaw/opencode-plugin
```

Then register in `~/.config/opencode/opencode.json` (global) or
`.opencode/opencode.json` (project):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    ["@dashclaw/opencode-plugin", {
      "baseUrl": "http://localhost:3310",
      "apiKey": "${DASHCLAW_API_KEY}",
      "agentId": "opencode-local",
      "highRiskTools": ["bash", "write", "patch"]
    }]
  ]
}
```

The plugin also reads from environment variables:

| Env var | Equivalent option |
|---|---|
| `DASHCLAW_BASE_URL` | `baseUrl` |
| `DASHCLAW_API_KEY` | `apiKey` |
| `DASHCLAW_AGENT_ID` | `agentId` |
| `DASHCLAW_AGENT_NAME` | `agentName` |
| `DASHCLAW_FAIL_CLOSED` | `failClosed` |
| `DASHCLAW_RISK_DEFAULT` | `riskScoreDefault` |
| `DASHCLAW_HIGH_RISK_TOOLS` | `highRiskTools` (comma-separated) |
| `DASHCLAW_DEFAULT_MODEL` | `defaultModel` |
| `DASHCLAW_APPROVAL_TIMEOUT_MS` | `approvalTimeoutMs` |

## Configuration reference

| Option | Default | Notes |
|---|---|---|
| `baseUrl` | — | DashClaw runtime URL. Required. |
| `apiKey` | — | Required. |
| `agentId` | `"opencode"` | Treat this as the governance routing key. Use a per-host or per-environment value (`opencode-prod-1`, `opencode-laptop-alex`). |
| `agentName` | `agentId` | Human-readable label in the audit trail. |
| `failClosed` | `true` | When the governance API is unreachable, block all tool calls. Set `false` to fail-open (with warnings). |
| `riskScoreDefault` | `50` | Risk score for tools not in the built-in heuristic. |
| `highRiskTools` | `[]` | Tools forced through the approval queue (bumps `risk_score` ≥ 90). |
| `ignoredTools` | `[]` | Tools skipped entirely (e.g. trivial reads). |
| `toolActionTypes` | `{}` | Map an opencode tool name to a DashClaw `action_type`. |
| `defaultModel` | — | Fallback model id when reporting outcomes. |
| `approvalTimeoutMs` | `300_000` | How long to wait for human approval before blocking. |

## Built-in tool risk heuristic

| Tool | `risk_score` | `reversible` |
|---|---|---|
| `read`, `glob`, `grep`, `list`, `todoread` | 5 | yes |
| `webfetch` | 20 | yes |
| `todowrite` | 30 | no |
| `edit`, `write`, `patch` | 60–65 | no |
| `bash` | 80 | no |

Override with `riskScoreDefault` for unknown tools, or with explicit policies
on the DashClaw side.

## Verifying the integration

1. Start DashClaw locally: `pnpm dev` (default `http://localhost:3310`).
2. Create an API key (Setup → API keys) and put it in your env.
3. Configure a policy that blocks `action_type=bash` for `agent_id=opencode-local`.
4. Run opencode with the plugin enabled and ask it to run a shell command.
5. The `bash` tool call should fail with `Action blocked by DashClaw policy`,
   and the decision should appear in `/decisions` and `/mission-control`.

## License

MIT
