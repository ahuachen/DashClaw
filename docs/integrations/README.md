# DashClaw Integrations

DashClaw governs **any** AI agent framework via a thin language-native
adapter. The adapter wires the framework's hook system into DashClaw's
4-step governance loop (`guard → record → verify → outcome`).

The adapter contract is defined in
[`../architecture/multi-agent-adapter.md`](../architecture/multi-agent-adapter.md).
Each integration ships as its own package under
[`../../packages/`](../../packages/) and has a setup guide here.

## Available adapters

| Framework | Language | Package | Setup guide |
|---|---|---|---|
| [OpenClaw](https://github.com/openclaw/openclaw) | TS | `@dashclaw/openclaw-plugin` | [openclaw.md](./openclaw.md) |
| [opencode](https://github.com/sst/opencode) | TS / Bun | `@dashclaw/opencode-plugin` | [opencode.md](./opencode.md) |
| [Hermes](https://github.com/NousResearch/hermes-agent) | Python | `dashclaw-hermes-plugin` | [hermes.md](./hermes.md) |

## What governance gives you

Once an agent is wired in, every tool call:

1. **Is policy-checked** before it executes — the runtime can `allow`,
   `block`, or escalate to `require_approval`.
2. **Is recorded** as a governance event with `agent_id`, `agent_name`,
   `action_type`, `risk_score`, `declared_goal`, and the original args.
3. **Surfaces in `/decisions`** (causal chain ledger) and
   `/mission-control` (live decision stream).
4. **Can be human-approved** via the DashClaw web UI / Slack / Telegram
   approval channels — the agent's tool call blocks until a reviewer
   acts (or until `approval_timeout_ms` elapses).
5. **Has its outcome closed** automatically — `status`, `error_message`,
   `duration_ms`, `tokens_in/out`, and `model` are reported back.

## Adding a new framework

See `multi-agent-adapter.md` §8 — five-step process for writing a new
adapter against an unfamiliar host framework. The adapter SHOULD be
implemented in the host framework's native language; cross-process
bridges are discouraged because most hook systems only block the
caller within the same process.
