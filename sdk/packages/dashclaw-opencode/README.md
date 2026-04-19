# @dashclaw/opencode

DashClaw governance integration for [OpenCode](https://opencode.ai) — MCP server and skill for governed AI coding agents.

Gives OpenCode agents policy enforcement, decision recording, and human approval gates via [DashClaw](https://github.com/ucsandman/DashClaw).

## Quick Start

### 1. Add MCP Server to OpenCode

Add to your OpenCode MCP configuration (`.opencode/mcp.json` or `opencode.json`):

```json
{
  "mcpServers": {
    "dashclaw": {
      "command": "npx",
      "args": ["@dashclaw/opencode"],
      "env": {
        "DASHCLAW_URL": "https://your-dashclaw.vercel.app",
        "DASHCLAW_API_KEY": "oc_live_xxx",
        "DASHCLAW_AGENT_ID": "opencode"
      }
    }
  }
}
```

### 2. Install the Skill

Copy the skill to your project:

```bash
npx @dashclaw/opencode install-skill
```

Or manually copy `.opencode/skills/dashclaw/SKILL.md` from this package to your project's `.opencode/skills/dashclaw/SKILL.md`.

## Running the MCP Server

### stdio (default, OpenCode standard)

```bash
# Via npx
npx @dashclaw/opencode --url https://your-dashclaw.app --key oc_live_xxx

# Via env vars
DASHCLAW_URL=https://your-dashclaw.app DASHCLAW_API_KEY=oc_live_xxx npx @dashclaw/opencode
```

## Tools

| Tool | When to call |
|------|-------------|
| `dashclaw_guard` | Before any risky action (file edits, shell exec, deploys) |
| `dashclaw_record` | After completing or failing a significant action |
| `dashclaw_wait_for_approval` | When guard returns `require_approval` |
| `dashclaw_session_start` | At the start of each coding task |
| `dashclaw_session_end` | At the end of each coding task |
| `dashclaw_capabilities_list` | Discover governed external APIs |
| `dashclaw_policies_list` | See active governance policies |

## Governance Loop

The skill teaches OpenCode to follow this pattern:

```
1. dashclaw_guard       → get permission
2. Execute action       → do the work
3. dashclaw_record      → log the outcome
4. dashclaw_wait_for_approval (if required)
```

## Configuration

| CLI Arg | Env Var | Default | Description |
|---------|---------|---------|-------------|
| `--url` | `DASHCLAW_URL` | `http://localhost:3000` | DashClaw instance URL |
| `--key` | `DASHCLAW_API_KEY` | (empty) | API key (`oc_live_` prefix) |
| `--agent-id` | `DASHCLAW_AGENT_ID` | (empty) | Default agent ID |

CLI args take precedence over environment variables.

## Mission Control

After configuring the MCP server, governed actions appear in DashClaw's:

- **`/mission-control`** — Live decision stream, interventions, strategic posture
- **`/decisions`** — Visual causal chain ledger of all governed actions

## Related

- [DashClaw](https://github.com/ucsandman/DashClaw) — The governance runtime
- [@dashclaw/mcp-server](../../mcp-server) — Generic MCP server (Claude Desktop, Claude Code)
- [OpenCode](https://opencode.ai) — The AI coding agent
