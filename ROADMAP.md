# DashClaw Roadmap

## Recently Shipped

- **v2.8** — Agent Intel hooks (40+ tool semantic classification), session lifecycle, 3 new policy types (permission_escalation, green_contract, branch_freshness), 4 new signal types, recovery recipe engine
- **v2.3** — Cost dashboard with agent spend tracking, policy template gallery with one-click install, approval webhooks (PagerDuty/Opsgenie compatible)
- **v2.2** — CLI approval client (`@dashclaw/cli`), Claude Code pretool/posttool hooks (zero-code governance), `npx dashclaw-demo` one-command demo, framework starters (Anthropic SDK, OpenAI Agents SDK)

## In Progress

- **AI Policy Generator** — Paste natural language company policies → DashClaw generates enforceable guard rules + recovery recipes with dry-run preview
- **Predictive Risk Scoring** — Statistical behavior analysis on every guard call + LLM-enhanced risk assessment for high-stakes actions
- **SSE Real-Time Events** — Replace polling-based `waitForApproval()` with server-sent events in both SDKs

## Exploring

- **Fleet & Enterprise** — Team invites, role-based policy inheritance, SSO, audit export (CSV/PDF/OpenTelemetry)
- **Framework Templates** — Full CrewAI, AutoGen, and LangGraph governance starters
- **Hosted Free Tier** — Managed DashClaw with 3 agents / 500 actions per month, Pro subscription for scaling
- **DashClaw Certified** — Badge program for agent builders who ship governed agents
- **Cost Optimization Engine** — Auto-suggest cheaper model routing based on action type and historical cost data

## Community

Have a feature request? [Open an issue](https://github.com/ucsandman/DashClaw/issues) or join the conversation in [Discussions](https://github.com/ucsandman/DashClaw/discussions).
