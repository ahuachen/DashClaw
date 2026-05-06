# Integration: OpenClaw

[OpenClaw](https://github.com/openclaw/openclaw) is the original framework
DashClaw was designed alongside. The adapter ships as
`@dashclaw/openclaw-plugin` (`packages/openclaw-plugin/`), is published to
npm, and hooks into OpenClaw's `before_tool_call` / `after_tool_call` /
`llm_output` / `agent_end` lifecycle.

This page is the high-level pointer; the full setup is in the package
README.

## Install

```bash
npm install @dashclaw/openclaw-plugin
```

## Configure

Register the plugin in OpenClaw's plugin manifest. The full configuration
schema is documented in
[`packages/openclaw-plugin/README.md`](../../packages/openclaw-plugin/README.md).

The standard env vars are the same as the other adapters:

```bash
DASHCLAW_BASE_URL=http://localhost:3310
DASHCLAW_API_KEY=dck_xxx
DASHCLAW_AGENT_ID=openclaw-prod-1
DASHCLAW_AGENT_NAME=OpenClaw (prod)
```

## Reference

- Plugin source: [`packages/openclaw-plugin/`](../../packages/openclaw-plugin/)
- Plugin entrypoint:
  [`packages/openclaw-plugin/src/index.ts`](../../packages/openclaw-plugin/src/index.ts)
- Adapter contract:
  [`../architecture/multi-agent-adapter.md`](../architecture/multi-agent-adapter.md)
