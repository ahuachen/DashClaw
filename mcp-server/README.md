# @dashclaw/mcp-server

MCP server for [DashClaw](https://github.com/ucsandman/DashClaw) governance. Exposes guard, record, invoke, and discovery tools over [Model Context Protocol](https://modelcontextprotocol.io/).

## Quick Start

### Claude Desktop / Claude Code (stdio)

```bash
npx @dashclaw/mcp-server --url https://your-dashclaw.vercel.app --key oc_live_xxx
```

Or add to `claude_desktop_config.json`:

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

### Claude Managed Agents (Streamable HTTP)

If you're running DashClaw, the MCP endpoint is built in at `/api/mcp`:

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

## Tools

| Tool | Description |
|---|---|
| `dashclaw_guard` | Evaluate policies before risky actions |
| `dashclaw_record` | Log actions to audit trail |
| `dashclaw_invoke` | Execute governed capabilities |
| `dashclaw_capabilities_list` | Discover available APIs |
| `dashclaw_policies_list` | See active governance policies |
| `dashclaw_wait_for_approval` | Wait for human approval |
| `dashclaw_session_start` | Register agent session |
| `dashclaw_session_end` | Close agent session |

## Resources

| URI | Description |
|---|---|
| `dashclaw://policies` | Active policy set |
| `dashclaw://capabilities` | Available capabilities and health |
| `dashclaw://agent/{agent_id}/history` | Recent action history |
| `dashclaw://status` | Instance health and metrics |

## Configuration

| CLI Arg | Env Var | Default | Description |
|---|---|---|---|
| `--url` | `DASHCLAW_URL` | `http://localhost:3000` | DashClaw instance URL |
| `--key` | `DASHCLAW_API_KEY` | (empty) | API key (`oc_live_` prefix) |
| `--agent-id` | `DASHCLAW_AGENT_ID` | (empty) | Default agent ID |

CLI args take precedence over environment variables.
