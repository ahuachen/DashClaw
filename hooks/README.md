# DashClaw Hooks for Claude Code

Two Python hook scripts that connect Claude Code to your DashClaw governance policies. Every Bash, Edit, Write, and MultiEdit tool call is evaluated against your DashClaw guard before execution. After execution, the outcome is recorded as evidence. No SDK instrumentation or code changes required in your project. Just drop the hooks in and set your environment variables.

## Installation

1. Copy the hook scripts into your project:

```bash
mkdir -p .claude/hooks
cp hooks/dashclaw_pretool.py .claude/hooks/
cp hooks/dashclaw_posttool.py .claude/hooks/
```

2. Merge the hooks block from `hooks/settings.json` into your `.claude/settings.json`. If you do not have a settings file yet, copy it directly:

```bash
cp hooks/settings.json .claude/settings.json
```

3. Set your environment variables:

```bash
export DASHCLAW_BASE_URL=https://your-dashclaw-instance.vercel.app
export DASHCLAW_API_KEY=your_api_key_here
export DASHCLAW_AGENT_ID=claude-code   # optional, defaults to "claude-code"
```

4. Test the integration:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"echo hello"},"tool_use_id":"test_001"}' \
  | python .claude/hooks/dashclaw_pretool.py
```

If DashClaw is reachable, the hook evaluates the command against your guard policies. If not, it exits silently and Claude Code proceeds normally.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `DASHCLAW_BASE_URL` | Yes | -- | URL of your DashClaw instance |
| `DASHCLAW_API_KEY` | Yes | -- | Operator API key from `/settings` |
| `DASHCLAW_AGENT_ID` | No | `claude-code` | Identity for this agent in DashClaw |
| `DASHCLAW_HOOK_MODE` | No | `enforce` | `enforce` blocks on policy violations. `observe` logs everything but never blocks. |
| `DASHCLAW_RISK_THRESHOLD` | No | `60` | Commands with risk above this threshold get elevated risk scores |

## Behavior

The PreToolUse hook calls `POST /api/guard` before each governed tool executes. The guard returns one of four decisions:

- **allow**: The tool proceeds. An action record is created for the evidence trail.
- **warn**: The tool proceeds. A warning is printed to the Claude Code terminal. An action record is created.
- **block**: In enforce mode, the tool is blocked and Claude Code sees the policy reason. In observe mode, the warning is logged but the tool proceeds.
- **require_approval**: In enforce mode, an action record is created in `pending_approval` status. The hook prints the action ID and a replay link, then polls for up to 30 seconds waiting for an operator to approve or deny. If approved, the tool proceeds. If denied or timed out, the tool is blocked. In observe mode, the action is recorded but the tool proceeds immediately.

The PostToolUse hook runs after execution completes. It updates the action record with the outcome (completed or failed) and a summary of the output. It never blocks.

If DashClaw is unreachable or misconfigured, both hooks exit silently and Claude Code operates normally. The hooks never crash your session.

## Approving from the terminal

When a tool call requires approval, the hook prints the action ID:

```
[DashClaw] Approval required
Action ID: act_abc123
Goal:      Bash: git push origin main
...
Approve from terminal: dashclaw approve act_abc123
```

If you have the `@dashclaw/cli` package installed, run `dashclaw approve act_abc123` from another terminal to approve inline. You can also approve from the DashClaw dashboard at `/approvals`. The replay link printed in the terminal (`<DASHCLAW_BASE_URL>/replay/<action_id>`) opens the full decision evidence in your browser.

## What gets governed

Four Claude Code tools are evaluated against DashClaw policies:

- **Bash**: Shell commands. Git operations, deployments, infrastructure commands, destructive operations, and HTTP calls get elevated risk scores. Package installs and general commands get lower scores.
- **Edit**: File edits. Sensitive files (`.env`, secrets, credentials), migrations, infrastructure configs, and auth-related files get elevated risk scores.
- **Write**: New file creation. Same risk mapping as Edit.
- **MultiEdit**: Batch file edits. Same risk mapping as Edit.

## What does not get governed

- All other Claude Code tools (Read, Glob, Grep, Agent, etc.) pass through without evaluation.
- Any tool call when `DASHCLAW_BASE_URL` or `DASHCLAW_API_KEY` is not set.
- Any tool call when DashClaw is unreachable (network error, timeout, server error).

## Replay

Every governed action creates a replayable evidence record in DashClaw. Visit `<DASHCLAW_BASE_URL>/replay/<action_id>` to see the full causal chain: what the agent intended, which policy was matched, whether approval was required, who approved it, and what the outcome was. This works for both allowed and blocked actions, giving operators a complete audit trail of what Claude Code did and why.
