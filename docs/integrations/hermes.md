# Integration: Hermes

[Hermes](https://github.com/NousResearch/hermes-agent) is a Python-based
agent framework with a 19-hook plugin system. The DashClaw adapter ships
as `dashclaw-hermes-plugin` and runs in-process — every `pre_tool_call`
goes through the DashClaw governance loop before the tool dispatches.

## Prerequisites

- A running DashClaw runtime (locally: `pnpm dev` → `http://localhost:3310`)
- A DashClaw API key (Setup → API keys)
- Hermes ≥ the version that ships the `pre_tool_call` block protocol
  (any release that defines `get_pre_tool_call_block_message` in
  `hermes_cli/plugins.py`)

## Install

```bash
pip install dashclaw-hermes-plugin
```

Hermes auto-discovers the plugin via the
`hermes_agent.plugins` entry point — no path configuration is needed.

## Configure

### 1. Enable the plugin

`~/.hermes/config.yaml`:

```yaml
plugins:
  enabled:
    - observability/dashclaw
```

(The plugin is **opt-in** — Hermes' plugin system requires explicit
enablement even after pip install.)

### 2. Set credentials

Put credentials in `~/.hermes/.env` (Hermes loads this automatically
before plugin discovery):

```bash
DASHCLAW_BASE_URL=http://localhost:3310
DASHCLAW_API_KEY=dck_xxx
DASHCLAW_AGENT_ID=hermes-laptop-alex
DASHCLAW_AGENT_NAME=Hermes (laptop · alex)
DASHCLAW_HIGH_RISK_TOOLS=bash,write_file,patch_file
DASHCLAW_FAIL_CLOSED=true
```

## What gets governed

| Hermes hook | DashClaw action |
|---|---|
| `pre_tool_call` | `POST /api/guard` → block / approve / allow → `POST /api/actions` |
| `post_tool_call` | `PATCH /api/actions/:id` (status, duration, result preview) |
| `on_session_start` | `POST /api/agents/heartbeat` (status="busy") |
| `on_session_end` | `POST /api/agents/heartbeat` (status="online") |
| (process start / atexit) | `POST /api/agents/heartbeat` (online / offline) |

When a policy decides `block` (or a human reviewer denies an action), the
`pre_tool_call` hook returns Hermes' standard block protocol:

```python
{"action": "block", "message": "Reason"}
```

Hermes' tool dispatcher (`model_tools.py:736-737`) surfaces this as the
tool result without ever executing the tool, and feeds the policy
reason back into the LLM context.

## Verifying end-to-end

1. Start DashClaw: `pnpm dev`.
2. Set env vars and start Hermes (`hermes`).
3. Hit the DashClaw heartbeat list to confirm discovery:
   ```bash
   curl -s -H "x-api-key: $DASHCLAW_API_KEY" http://localhost:3310/api/agents \
     | jq '.agents[] | select(.agent_id | startswith("hermes-"))'
   ```
   You should see your agent with `presence_metadata.agent_type ==
   "hermes"`.
4. Ask Hermes to run `bash` or `write_file`. The tool call should
   produce a guard decision visible at `/decisions` and
   `/mission-control`.
5. Add a policy that blocks `action_type=bash` for your `agent_id`, then
   re-run. Hermes will receive `{"error": "Reason"}` from the tool
   instead of executing it.

## Troubleshooting

**Plugin appears in `hermes plugins list` but never fires.**
Confirm it's enabled (`hermes plugins enable observability/dashclaw`)
**and** that `DASHCLAW_BASE_URL` + `DASHCLAW_API_KEY` are set in
`~/.hermes/.env`. Without credentials, the plugin loads but its
`register()` returns early with a warning.

**`atexit` heartbeat never reaches "offline".**
Hermes runs `atexit` handlers — but only when the process exits
cleanly. SIGKILL (or `hermes` running in a watcher loop) won't trigger
them. The presence record will go `stale` after `AGENT_ONLINE_WINDOW_MS`
(default 10 min) regardless.

**Approval requests block forever.**
The `pre_tool_call` hook is **synchronous** — the Hermes tool dispatcher
is paused until human approval lands or `DASHCLAW_APPROVAL_TIMEOUT_MS`
fires (default 5 min). Don't put `bash` in `DASHCLAW_HIGH_RISK_TOOLS`
unless you actually have someone watching the approval queue.

**Tool risk-score heuristic doesn't match your tools.**
The built-in heuristic only knows the well-known names (`bash`,
`read_file`, `edit_file`, …). For Hermes' large optional toolset,
either:

- Add policies on the DashClaw side that match by `tool` metadata, OR
- Set `tool_action_types` to map your tool names to canonical
  `action_type`s, OR
- Bump `DASHCLAW_RISK_DEFAULT` so unknown tools fall above your
  approval threshold.

## Reference

- Plugin source: [`packages/hermes-plugin/`](../../packages/hermes-plugin/)
- Configuration shape:
  [`packages/hermes-plugin/dashclaw_governance/config.py`](../../packages/hermes-plugin/dashclaw_governance/config.py)
- Hermes plugin system reference (host framework, not modified):
  `~/dev/project/ai-agent-bot/hermes-agent/hermes_cli/plugins.py`
- Hermes block protocol:
  `~/dev/project/ai-agent-bot/hermes-agent/hermes_cli/plugins.py:1172-1208`
- Hermes tool dispatcher:
  `~/dev/project/ai-agent-bot/hermes-agent/model_tools.py:687-740`
