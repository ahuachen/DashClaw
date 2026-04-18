// Pure template functions for rendering per-stack integration snippets.
// Given a provisioning result (endpoint, apiKey, workspaceId), returns
// { language, code } the UI renders as a copy-paste block.

export const STACK_OPTIONS = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    description: 'PreToolUse / PostToolUse hooks wired into your Claude Code settings.',
  },
  {
    id: 'openclaw',
    label: 'OpenClaw',
    description: 'Framework-native plugin that handles guard + record + waitForApproval automatically.',
  },
  {
    id: 'codex',
    label: 'Codex',
    description: 'Drop-in hook config for OpenAI Codex CLI.',
  },
  {
    id: 'langchain',
    label: 'LangChain',
    description: 'Python initializer that wraps your chain with DashClaw governance.',
  },
  {
    id: 'mcp',
    label: 'MCP Server',
    description: 'Zero-code option for Claude Code, Claude Desktop, or any MCP host.',
  },
];

function claudeCode({ endpoint, apiKey }) {
  return `{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash|Edit|Write|MultiEdit",
      "hooks": [{
        "type": "command",
        "command": "npx @dashclaw/claude-code-hook"
      }]
    }]
  },
  "env": {
    "DASHCLAW_URL": "${endpoint}",
    "DASHCLAW_API_KEY": "${apiKey}"
  }
}`;
}

function openclaw({ endpoint, apiKey }) {
  return `# One-shot install for Claude Code + OpenClaw plugin:
DASHCLAW_URL="${endpoint}" \\
DASHCLAW_API_KEY="${apiKey}" \\
npx @dashclaw/openclaw-plugin@latest install`;
}

function codex({ endpoint, apiKey }) {
  return `{
  "governance": {
    "provider": "dashclaw",
    "endpoint": "${endpoint}",
    "api_key": "${apiKey}",
    "hooks": ["pre_tool_use", "post_tool_use"]
  }
}`;
}

function langchain({ endpoint, apiKey }) {
  return `# pip install dashclaw
import os
from dashclaw import DashclawClient

os.environ["DASHCLAW_URL"] = "${endpoint}"
os.environ["DASHCLAW_API_KEY"] = "${apiKey}"

client = DashclawClient()
# Wrap each tool call:
#   decision = client.guard(agent_id="my-agent", action_type="...", ...)
#   if decision.allow: ... ; client.record_outcome(...)`;
}

function mcp({ endpoint, apiKey }) {
  return `{
  "mcpServers": {
    "dashclaw": {
      "command": "npx",
      "args": ["@dashclaw/mcp-server"],
      "env": {
        "DASHCLAW_URL": "${endpoint}",
        "DASHCLAW_API_KEY": "${apiKey}"
      }
    }
  }
}`;
}

const RENDERERS = {
  'claude-code': { language: 'json', fn: claudeCode },
  openclaw: { language: 'bash', fn: openclaw },
  codex: { language: 'json', fn: codex },
  langchain: { language: 'python', fn: langchain },
  mcp: { language: 'json', fn: mcp },
};

export function renderTemplate(stackId, { endpoint, apiKey, workspaceId }) {
  const entry = RENDERERS[stackId];
  if (!entry) throw new Error(`unknown stack: ${stackId}`);
  return {
    language: entry.language,
    code: entry.fn({ endpoint, apiKey, workspaceId }),
  };
}
