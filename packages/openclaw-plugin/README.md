# @dashclaw/openclaw-plugin

Add DashClaw governance to OpenClaw — every tool call gets policy enforcement, human approval gates, and a verifiable decision trail.

## Install

```bash
openclaw plugins install @dashclaw/openclaw-plugin
```

## Configure

Add the plugin to your OpenClaw config:

```json
{
  "plugins": {
    "entries": {
      "dashclaw-governance": {
        "enabled": true,
        "config": {
          "dashclawUrl": "https://my-dashclaw.vercel.app",
          "dashclawApiKey": "oc_live_...",
          "agentId": "my-openclaw-agent",
          "failClosed": true,
          "highRiskTools": ["bash", "exec", "write_file"]
        }
      }
    }
  }
}
```

Config changes require a gateway restart, the same as any other OpenClaw plugin.

## What happens

Every tool call your agent makes flows through DashClaw before it executes:

1. Agent decides to call a tool (e.g. `bash`, `write_file`, a custom HTTP tool).
2. The plugin's `before_tool_call` hook calls DashClaw `/api/guard` with the tool name, risk score, and a 500-character summary of the parameters.
3. DashClaw evaluates your guard policies (risk thresholds, action-type blocks, allowlists). If the verdict is `block`, the tool call is rejected immediately — no action record is opened.
4. On `allow`, `warn`, or `require_approval`, the plugin opens a governance record via `/api/actions`. The server re-runs policy here and is the authoritative source for HITL gating — it may return `action.status === 'pending_approval'` even when guard said `allow` (for example, if the capability has `requires_approval: true`).
5. If the action is `pending_approval`, the plugin pauses on `waitForApproval(action.action_id)`. You approve from the DashClaw dashboard, the CLI, or the mobile PWA — the agent is unblocked the moment the operator clicks approve (SSE first, polling fallback).
6. On approval, the tool executes. The `after_tool_call` hook records the outcome (`completed` or `failed`, with the error message) so DashClaw has a full intent → policy → outcome trail.

The plugin is read-mostly: it never modifies the tool's parameters or the tool's result. It only blocks, allows, or records.

### `action_id` distinction

`guard()` returns an `action_id` that points at the `guard_decisions` table
(prefix `act_gd_…`). `createAction()` returns an `action_id` that points at
the `action_records` table. `waitForApproval()` polls
`GET /api/actions/:id`, which resolves against `action_records` — so the
plugin always waits using the `createAction()` ID, never the `guard()` ID.
Plugin builds at `1.0.0` had this wrong and the PWA approval queue stayed
empty because the wait target didn't exist. Fixed in `1.0.1`.

## Configuration reference

| Field | Type | Default | Description |
|---|---|---|---|
| `dashclawUrl` | string | **required** | Base URL of your DashClaw instance, e.g. `https://my-dashclaw.vercel.app`. |
| `dashclawApiKey` | string | **required** | DashClaw API key (starts with `oc_live_`). |
| `agentId` | string | `"openclaw"` | Identifier this OpenClaw instance reports to DashClaw. |
| `failClosed` | boolean | `true` | If DashClaw is unreachable, block the tool call. Set `false` to fail open. |
| `riskScoreDefault` | number | `50` | Risk score sent to `/api/guard` for tool calls that don't appear in `highRiskTools`. |
| `highRiskTools` | string[] | `[]` | Tool names that should always be evaluated at risk score 85. Typical: `bash`, `exec`, `deploy`, `write_file`. |

## Fail-closed vs fail-open

- **`failClosed: true` (default)** — if DashClaw is unreachable for any reason (network error, 5xx, timeout), the plugin blocks the tool call with a clear reason. This is the safe default for governance: no decisions slip through unrecorded.
- **`failClosed: false`** — if DashClaw is unreachable, the plugin logs a warning and lets the tool call proceed. Choose this only when availability matters more than governance guarantees (e.g. a non-critical agent that should keep running through DashClaw outages).

The fail-closed branch only fires for **infrastructure failures** talking to DashClaw. Explicit `block` or denied `require_approval` decisions always block the tool call regardless of `failClosed`.

## How tool names are resolved

OpenClaw events use slightly different field names across versions and providers, so the plugin probes `event.toolName`, `event.tool`, `event.tool_name`, and `event.name` in that order. If none match, it reports the action as `unknown_tool` to DashClaw rather than crashing — you'll still get a record, just less useful, and that signals it's time to file an issue.

## Outcome recording

The plugin caches the DashClaw `action_id` from `before_tool_call` in a module-level map keyed by the call id, then resolves it in `after_tool_call` to send `updateOutcome`. If `after_tool_call` doesn't fire (process crash, hook misordering), the action stays in `running` state in DashClaw — you'll see it in the open-loops view and can resolve it manually.

If the outcome update itself fails, the plugin logs a warning but never throws — DashClaw recording is best-effort and must not break your agent's tool execution.

## Links

- DashClaw: <https://github.com/ucsandman/DashClaw>
- DashClaw Node SDK: <https://www.npmjs.com/package/dashclaw>
- OpenClaw: <https://docs.openclaw.ai>

## License

MIT — see [LICENSE](./LICENSE).
