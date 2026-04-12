# @dashclaw/cli

Terminal client for [DashClaw](https://dashclaw.io) — approve agent actions and diagnose your instance without leaving the shell.

## Install

```bash
npm install -g @dashclaw/cli
```

## Configure

```bash
export DASHCLAW_BASE_URL="https://your-dashclaw.example.com"
export DASHCLAW_API_KEY="oc_live_..."
```

Optionally set `DASHCLAW_AGENT_ID` (defaults to `cli-operator`) for audit attribution.

## Commands

### `dashclaw approvals`

Interactive inbox for all pending approval requests. Use arrow keys to navigate, `A` to approve, `D` to deny, `O` to open the replay link, `Q` to quit.

### `dashclaw approve <actionId>`

Approve a single action by ID.

```bash
dashclaw approve act_01h... --reason "Verified change window"
```

### `dashclaw deny <actionId>`

Deny a single action by ID.

```bash
dashclaw deny act_01h... --reason "Outside change window"
```

### `dashclaw doctor`

Diagnose your DashClaw instance and auto-fix safe issues. Checks database, configuration, auth, deployment, SDK reachability, and governance.

```bash
dashclaw doctor                          # rich terminal output, auto-fix what it can
dashclaw doctor --json                   # JSON output for CI/scripts
dashclaw doctor --no-fix                 # diagnose only
dashclaw doctor --category database,config
```

The CLI invokes your instance's `/api/doctor` endpoints, so fixes that need filesystem access (env writes) are handled separately by self-hosters running `npm run doctor` locally.

### `dashclaw help`

Show all commands and flags.

## Exit codes

- `0` — healthy
- `1` — warnings present, failures, or the instance was unreachable

## License

MIT.
