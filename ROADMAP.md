# DashClaw Roadmap

## Recently Shipped

- **v2.11** — Artifact & evidence layer (durable artifacts, auto-capture from workflow steps, evidence bundles), runtime observability (stuck workflow + approval backlog signals, cancel workflow, runtime summary metrics), operator cockpit decision support (Retry/Disable/Cancel actions in operations feed), maturity labels across all UI pages
- **v2.10** — Workflow Runtime V2 (run persistence with full step I/O, conditional execution, continue-on-failure, resume from checkpoint), Operator Cockpit V1 (unified operations feed replacing Mission Control activity split), SSE-powered `waitForApproval()` in Node + Python SDKs, AutoGen governed example, enhanced CrewAI/LangGraph examples
- **v2.9** — AI Policy Generator with dry-run preview, predictive risk scoring in guard engine, guided UX for policies/capabilities/workflows/model strategies, capability runtime v2 (contracts, invoke, health, circuit breaker, retry), provider registry convergence
- **v2.8** — Agent Intel hooks (40+ tool semantic classification), session lifecycle, 3 new policy types (permission_escalation, green_contract, branch_freshness), 4 new signal types, recovery recipe engine
- **v2.3** — Cost dashboard with agent spend tracking, policy template gallery with one-click install, approval webhooks (PagerDuty/Opsgenie compatible)
- **v2.2** — CLI approval client (`@dashclaw/cli`), Claude Code pretool/posttool hooks (zero-code governance), `npx dashclaw-demo` one-command demo, framework starters (Anthropic SDK, OpenAI Agents SDK)

## In Progress

- **Artifact Preview & Search** — Content preview, full-text search across artifacts, diff support for patch artifacts
- **Pricing & Packaging** — Tier-based plans aligned to governed actions, capability invocations, and workflow runs

## Exploring

- **Claude Managed Agents Integration** — Cloud-hosted agents governed by DashClaw custom tools (guard, invoke, record). See `examples/managed-agent-governed/`
- **Multi-Agent Task Topology** — Parent/child task model, dependency graph, ownership, escalation flows
- **Trust & Permissions** — Agent roles, scoped capability access, delegated authority, approval chains
- **Memory Architecture** — Unified episodic/semantic/procedural memory with freshness, trust, and compaction
- **Advanced Model Ops** — A/B strategy experiments, rollout controls, structured output validation, prompt lineage
- **Fleet & Enterprise** — Team invites, role-based policy inheritance, SSO, audit export (CSV/PDF/OpenTelemetry)
- **Hosted Free Tier** — Managed DashClaw with 3 agents / 500 actions per month, Pro subscription for scaling
- **DashClaw Certified** — Badge program for agent builders who ship governed agents

## Community

Have a feature request? [Open an issue](https://github.com/ucsandman/DashClaw/issues) or join the conversation in [Discussions](https://github.com/ucsandman/DashClaw/discussions).
