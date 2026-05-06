# Integration: opencode

[opencode](https://github.com/sst/opencode) is a TypeScript / Bun-based
coding agent. The DashClaw adapter is shipped as `@dashclaw/opencode-plugin`
and runs inside the opencode server process — every `tool.execute.before`
goes through the DashClaw governance loop before the tool runs.

## Prerequisites

- A running DashClaw runtime (locally: `pnpm dev` → `http://localhost:3310`)
- A DashClaw API key (Setup → API keys)
- opencode installed (`bun install` in your project, or installed globally)

## Install

In your opencode workspace (or globally):

```bash
bun add @dashclaw/opencode-plugin
```

## Configure

Register the plugin in `.opencode/opencode.json` (project-local) or
`~/.config/opencode/opencode.json` (global):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    ["@dashclaw/opencode-plugin", {
      "baseUrl": "http://localhost:3310",
      "apiKey": "${DASHCLAW_API_KEY}",
      "agentId": "opencode-laptop-alex",
      "agentName": "OpenCode (laptop · alex)",
      "highRiskTools": ["bash", "write", "patch"],
      "ignoredTools": ["read", "glob", "grep"],
      "failClosed": true
    }]
  ]
}
```

`apiKey` resolves `${DASHCLAW_API_KEY}` against the environment, so a
common pattern is to put the secret in `~/.config/opencode/.env` (loaded
automatically by opencode).

## What gets governed

| opencode hook | DashClaw action |
|---|---|
| `tool.execute.before` | `POST /api/guard` → block / approve / allow → `POST /api/actions` |
| `tool.execute.after` | `PATCH /api/actions/:id` (status, duration, output preview) |
| `permission.ask` | `POST /api/guard` → may set `output.status = "deny"` |
| (process start / stop) | `POST /api/agents/heartbeat` (online / offline) |

When a policy decides `block` (or a human reviewer denies an action), the
`tool.execute.before` hook **throws** — opencode's plugin trigger surfaces
this as a tool failure, preventing the tool from executing and feeding
the policy reason back into the LLM context.

## Verifying end-to-end

1. Start DashClaw: `pnpm dev`.
2. Set the env vars and start opencode in your project.
3. In another terminal, hit the DashClaw heartbeat list to confirm
   discovery:
   ```bash
   curl -s -H "x-api-key: $DASHCLAW_API_KEY" http://localhost:3310/api/agents \
     | jq '.agents[] | select(.agent_id | startswith("opencode-"))'
   ```
   You should see your agent with `presence_metadata.agent_type ==
   "opencode"`.
4. Ask opencode to run a shell command. The tool call should produce a
   guard decision visible at `/decisions` and mission-control.
5. Add a policy that blocks `action_type=bash` for your `agent_id`, then
   re-run. The tool call should fail with the policy's reason.

## Troubleshooting

**The plugin loads but no decisions show up.**
Check `agentId` — `/api/agents` aggregates by `agent_id`. Two laptops with
the same `agentId` will collide. Use per-host or per-environment ids.

**Tools run even when DashClaw is down.**
You probably have `failClosed: false` (or the env override
`DASHCLAW_FAIL_CLOSED=false`). The default is to block on unreachable.

**Approval requests never resolve.**
Check `approvalTimeoutMs` (default 5 min). Confirm your DashClaw setup
has at least one approval channel wired up (`/connect` page).

**Built-in tool risk doesn't match your taxonomy.**
Override per-tool action types via `toolActionTypes`:
```json
{ "toolActionTypes": { "bash": "shell.execute", "write": "fs.write" } }
```

## Reference

- Plugin source: [`packages/opencode-plugin/`](../../packages/opencode-plugin/)
- Configuration shape:
  [`packages/opencode-plugin/src/config.ts`](../../packages/opencode-plugin/src/config.ts)
- opencode plugin SDK reference (host framework, not modified):
  `~/dev/project/ai-coding/opencode/packages/plugin/src/index.ts`
