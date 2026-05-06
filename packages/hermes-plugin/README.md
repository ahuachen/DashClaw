# dashclaw-hermes-plugin

DashClaw governance for [Hermes](https://github.com/NousResearch/hermes-agent) —
every Hermes tool call is policy-gated, optionally human-approved, and
recorded as a governance event with a full audit trail.

## What it does

Wires four Hermes hooks into the DashClaw governance loop:

| Hermes hook | DashClaw step |
|---|---|
| `pre_tool_call` | `POST /api/guard` → (optional `waitForApproval`) → `POST /api/actions` |
| `post_tool_call` | `PATCH /api/actions/:id` (outcome) |
| `on_session_start` | `POST /api/agents/heartbeat` (status="busy") |
| `on_session_end` | `POST /api/agents/heartbeat` (status="online") |

When DashClaw decides `block` (or a human reviewer denies the action), the
hook returns Hermes' standard block protocol:

```python
{"action": "block", "message": "Reason"}
```

Hermes' tool dispatcher (`model_tools.py:736-737`) then surfaces this as
the tool result without ever executing the tool.

## Install

```bash
pip install dashclaw-hermes-plugin
```

Then enable it in `~/.hermes/config.yaml`:

```yaml
plugins:
  enabled:
    - observability/dashclaw
```

Set credentials via env (recommended) — Hermes loads `~/.hermes/.env`
automatically before plugin discovery:

```bash
# ~/.hermes/.env
DASHCLAW_BASE_URL=http://localhost:3310
DASHCLAW_API_KEY=dck_xxx
DASHCLAW_AGENT_ID=hermes-laptop-alex
DASHCLAW_AGENT_NAME="Hermes (laptop)"
DASHCLAW_HIGH_RISK_TOOLS=bash,write_file,patch_file
DASHCLAW_FAIL_CLOSED=true
```

## Configuration reference

| Env var / config key | Default | Notes |
|---|---|---|
| `DASHCLAW_BASE_URL` / `base_url` | — | DashClaw runtime URL. Required. |
| `DASHCLAW_API_KEY` / `api_key` | — | Required. |
| `DASHCLAW_AGENT_ID` / `agent_id` | `"hermes"` | Governance routing key. Use a per-host or per-environment value. |
| `DASHCLAW_AGENT_NAME` / `agent_name` | `hermes@<hostname>` | Human-readable label in audit trail. |
| `DASHCLAW_FAIL_CLOSED` / `fail_closed` | `true` | When the governance API is unreachable, block all tool calls. |
| `DASHCLAW_RISK_DEFAULT` / `risk_score_default` | `50` | Risk score for tools not in built-in heuristic. |
| `DASHCLAW_HIGH_RISK_TOOLS` / `high_risk_tools` | `[]` | Comma-separated tools forced to risk≥90 (typically routes to approval queue). |
| `DASHCLAW_DEFAULT_MODEL` / `default_model` | — | Fallback model id for outcome reporting. |
| `DASHCLAW_APPROVAL_TIMEOUT_MS` / `approval_timeout_ms` | `300000` | Max wait for human approval. |
| `DASHCLAW_REQUEST_TIMEOUT_MS` / `request_timeout_ms` | `10000` | Per-HTTP-request timeout. |

## Built-in tool risk heuristic

| Tool | `risk_score` | `reversible` |
|---|---|---|
| `read_file`, `list_directory`, `find_files`, `search_text`, `todo_read` | 5 | yes |
| `fetch_url` | 20 | yes |
| `todo_write` | 30 | no |
| `edit_file`, `write_file`, `patch_file` | 60–65 | no |
| `bash`, `shell`, `execute_command`, `run_shell_command` | 80 | no |

Override with `risk_score_default` for unknown tools, or with explicit
policies on the DashClaw side.

## Verifying the integration

1. Start DashClaw locally: `pnpm dev` (default `http://localhost:3310`).
2. Create an API key on the DashClaw setup page and set `DASHCLAW_API_KEY`.
3. Configure a policy that blocks `action_type=bash` for
   `agent_id=hermes-laptop-alex`.
4. Run Hermes (`hermes`) and ask the agent to run a shell command.
5. The `bash` tool call should fail with the policy reason, and the
   decision should appear in `/decisions` and `/mission-control`.

## Running tests

```bash
cd packages/hermes-plugin
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python httpx pytest
.venv/bin/python -m pytest tests/ -v
```

Tests use mocks — no DashClaw server required.

## License

MIT
